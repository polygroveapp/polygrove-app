// Offline engine (design locked 2026-09-26): a rolling 100-card pack QUEUE
// plus journal SNAPSHOTS. Every pack open pops the queue's front — one code
// path, photos always instant from disk. Online, the tail refills right away
// so the queue sits at 100; offline it drains and refills in 25-card batches
// when signal returns. Collecting a card snapshots everything it needs (card
// JSON + field note + GloBI rows + photo file) forever; releasing deletes the
// photo. The full catalog is NEVER cached — that's the website's job.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  Card, cardById, getCards, loadCatalog, photoFor,
  registerOfflineCard, unregisterLocalPhoto,
} from './catalog';
import { loadCollection, owns } from './collection';
import { GlobiRow, fieldNote, globiRecords, seedDossier } from './dossier';

export type Stashed = {
  card: Card;
  note: string | null;
  globi: GlobiRow[];
  photoUrl?: string;    // the CDN thumb — keeps the ⓘ Commons link working offline
  photoFile?: string;   // basename under photos/ — uri rebuilt at load (iOS moves
                        // the app sandbox between updates, absolute uris go stale)
};

const QKEY = 'polygrove.packqueue.v1';
const snapKey = (sid: number) => `polygrove.snap.v1.${sid}`;
export const PACK_SIZE = 5;
const QUEUE_TARGET = 100;
const BATCH = 25;

let _queue: Stashed[] = [];
const _snaps: Record<number, Stashed> = {};
let _init: Promise<void> | null = null;
let _topping = false;

const canFS = Platform.OS !== 'web';   // web dev falls back to network photos
const photosDir = () => new Directory(Paths.document, 'photos');
const photoUri = (name: string) => new File(photosDir(), name).uri;

function register(s: Stashed) {
  registerOfflineCard(
    s.card,
    s.photoFile && canFS ? photoUri(s.photoFile) : undefined,
    s.photoUrl,
  );
  seedDossier(s.card.sci, s.note, s.globi);
}

// load queue + snapshots from storage and register every card so cardById /
// photoFor / field notes / GloBI panels work with zero network
export function offlineReady() {
  _init ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(QKEY);
      if (raw) _queue = JSON.parse(raw);
    } catch { _queue = []; }
    try {
      const col = await loadCollection();
      const keys = Object.values(col).map(o => snapKey(o.speciesId));
      if (keys.length) {
        for (const [, v] of await AsyncStorage.multiGet(keys)) {
          if (!v) continue;
          try {
            const s: Stashed = JSON.parse(v);
            _snaps[s.card.species_id] = s;
          } catch { /* corrupt row — heal loop rebuilds it */ }
        }
      }
    } catch { /* fresh start */ }
    Object.values(_snaps).forEach(register);
    _queue.forEach(register);
  })();
  return _init;
}

export const packsReady = () => Math.floor(_queue.length / PACK_SIZE);

async function persistQueue() {
  try { await AsyncStorage.setItem(QKEY, JSON.stringify(_queue)); } catch { /* best effort */ }
}

// pop the front pack — null means the queue can't serve one (fresh install,
// or a 20-pack offline binge); pack.tsx then falls back to a live draw
export function popPack(): Stashed[] | null {
  if (_queue.length < PACK_SIZE) return null;
  const pack = _queue.splice(0, PACK_SIZE);
  persistQueue();
  topUp();   // refill the tail — ~300KB, lands before the swipes finish
  return pack;
}

function drawFresh(n: number): Card[] {
  const all = getCards();
  if (!all.length) return [];
  const taken = new Set<number>(_queue.map(s => s.card.species_id));
  const picked: Card[] = [];
  let guard = 0;
  while (picked.length < n && guard++ < 4000) {
    const c = all[Math.floor(Math.random() * all.length)];
    if (taken.has(c.species_id) || owns(c.species_id) || _snaps[c.species_id] || !photoFor(c.id)) continue;
    taken.add(c.species_id);
    picked.push(c);
  }
  return picked;
}

async function downloadPhoto(sid: number, url: string): Promise<string | undefined> {
  if (!canFS) return undefined;
  try {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const name = `${sid}.jpg`;
    const dest = new File(dir, name);
    if (dest.exists) return name;   // re-pull of a prior queue/journal photo
    await File.downloadFileAsync(url, dest);
    return name;
  } catch { return undefined; }
}

async function prep(card: Card): Promise<Stashed | null> {
  try {
    const photoUrl = photoFor(card.id, 500);
    if (!photoUrl || photoUrl.startsWith('file:')) return null;
    const [note, globi] = await Promise.all([fieldNote(card.sci), globiRecords(card.sci)]);
    let photoFile: string | undefined;
    if (canFS) {
      photoFile = await downloadPhoto(card.species_id, photoUrl);
      if (!photoFile) return null;   // queued cards must be FULLY offline-ready
    }
    return { card, note, globi, photoUrl, photoFile };
  } catch { return null; }
}

// keep the queue at 100 in 25-card batches. Failures are silent = offline;
// retried on the next trigger (home mount, pack open, home retry tap).
export async function topUp() {
  if (_topping) return;
  _topping = true;
  try {
    await offlineReady();
    while (_queue.length < QUEUE_TARGET) {
      await loadCatalog();   // rejects offline → ride on what we have
      const fresh = drawFresh(Math.min(BATCH, QUEUE_TARGET - _queue.length));
      if (!fresh.length) break;
      const stashed = (await Promise.all(fresh.map(prep))).filter((s): s is Stashed => !!s);
      if (!stashed.length) break;   // every download failing → connection died
      stashed.forEach(register);
      _queue.push(...stashed);
      await persistQueue();
    }
    // heal: owned cards missing their snapshot (app died mid-collect)
    const col = await loadCollection();
    for (const o of Object.values(col)) {
      if (_snaps[o.speciesId]) continue;
      const c = cardById(o.id);
      if (!c) continue;
      const st = await prep(c);
      if (st) snapshotStashed(st);
    }
  } catch { /* offline */ }
  finally { _topping = false; }
}

// swipe RIGHT: journal — the snapshot makes the card readable forever offline
export function snapshotStashed(s: Stashed) {
  (async () => {
    try {
      if (!s.photoFile && s.photoUrl) s.photoFile = await downloadPhoto(s.card.species_id, s.photoUrl);
      if (s.note === null) { try { s.note = await fieldNote(s.card.sci); } catch { /* offline */ } }
      if (!s.globi.length) { try { s.globi = await globiRecords(s.card.sci); } catch { /* offline */ } }
      _snaps[s.card.species_id] = s;
      register(s);
      await AsyncStorage.setItem(snapKey(s.card.species_id), JSON.stringify(s));
    } catch { /* heal loop retries */ }
  })();
}

// swipe LEFT: release — drop the photo file unless the card is owned
export function releaseStashed(s: Stashed) {
  if (!canFS || !s.photoFile || owns(s.card.species_id)) return;
  unregisterLocalPhoto(s.card.id);
  try { new File(photosDir(), s.photoFile).delete(); } catch { /* already gone */ }
}
