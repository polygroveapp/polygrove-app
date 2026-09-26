// Offline engine (design locked 2026-09-26): a rolling 100-card pack QUEUE
// PER ECOREGION plus journal SNAPSHOTS. Every pack open pops the front of the
// current ecoregion's queue — one code path, photos always instant from disk.
// Online, the tail refills right away so the queue sits at 100; offline it
// drains and refills in 25-card batches when signal returns. Collecting a
// card snapshots everything it needs (card JSON + field note + GloBI rows +
// photo file) forever; snapshots and photos are keyed by SPECIES, so a species
// collected in two ecoregions is stored once. The full catalog is NEVER
// cached — that's the website's job.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import {
  Card, cardById, loadCatalog, photoRemote, registerOfflineCard, unregisterLocalPhoto,
} from './catalog';
import { allOwned, loadCollection, owns, ownsAnywhere } from './collection';
import { GlobiRow, fieldNote, globiRecords, seedDossier } from './dossier';
import { currentEco, ecoMembers, loadCurrentEco } from './ecoregions';

export type Stashed = {
  card: Card;
  note: string | null;
  globi: GlobiRow[];
  photoUrl?: string;    // the CDN thumb — keeps the ⓘ Commons link working offline
  photoFile?: string;   // basename under photos/ — uri rebuilt at load (iOS moves
                        // the app sandbox between updates, absolute uris go stale)
};

const qKey = (eid: number) => `polygrove.packqueue.v2.${eid}`;
const snapKey = (sid: number) => `polygrove.snap.v1.${sid}`;
export const PACK_SIZE = 5;
const QUEUE_TARGET = 100;
const BATCH = 25;

const _queues: Record<number, Stashed[]> = {};
const _queueLoaded: Record<number, Promise<void>> = {};
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

function loadQueue(eid: number) {
  _queueLoaded[eid] ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(qKey(eid));
      _queues[eid] = raw ? JSON.parse(raw) : [];
    } catch { _queues[eid] = []; }
    _queues[eid].forEach(register);
  })();
  return _queueLoaded[eid];
}

// load snapshots + the current ecoregion's queue and register every card so
// cardById / photoFor / field notes / GloBI panels work with zero network
export function offlineReady() {
  _init ||= (async () => {
    try {
      await loadCollection();
      const keys = [...new Set(allOwned().map(o => snapKey(o.speciesId)))];
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
    const eco = await loadCurrentEco();
    if (eco) await loadQueue(eco.eid);
  })();
  return _init;
}

export const packsReady = (eid: number) => Math.floor((_queues[eid]?.length || 0) / PACK_SIZE);

async function persistQueue(eid: number) {
  try { await AsyncStorage.setItem(qKey(eid), JSON.stringify(_queues[eid] || [])); } catch { /* best effort */ }
}

// pop the front pack of an ecoregion's queue — null means it can't serve one
// (fresh ecoregion before the first top-up, or a 20-pack offline binge);
// pack.tsx then falls back to a live draw
export function popPack(eid: number): Stashed[] | null {
  const q = _queues[eid];
  if (!q || q.length < PACK_SIZE) return null;
  const pack = q.splice(0, PACK_SIZE);
  persistQueue(eid);
  topUp();   // refill the tail — ~300KB, lands before the swipes finish
  return pack;
}

function drawFresh(eid: number, n: number): Card[] {
  const deck = ecoMembers(eid);
  if (!deck.length) return [];
  const q = _queues[eid] || [];
  const taken = new Set<number>(q.map(s => s.card.species_id));
  const picked: Card[] = [];
  let guard = 0;
  while (picked.length < n && guard++ < 4000) {
    const c = deck[Math.floor(Math.random() * deck.length)];
    if (taken.has(c.species_id) || owns(eid, c.species_id)) continue;
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
    if (dest.exists) return name;   // shared by every deck + the journal
    await File.downloadFileAsync(url, dest);
    return name;
  } catch { return undefined; }
}

async function prep(card: Card): Promise<Stashed | null> {
  try {
    const snap = _snaps[card.species_id];
    if (snap) return { ...snap, card };   // already journaled elsewhere — reuse
    const photoUrl = photoRemote(card.id, 500);
    if (!photoUrl) return null;
    const [note, globi] = await Promise.all([fieldNote(card.sci), globiRecords(card.sci)]);
    let photoFile: string | undefined;
    if (canFS) {
      photoFile = await downloadPhoto(card.species_id, photoUrl);   // no-op if on disk
      if (!photoFile) return null;   // queued cards must be FULLY offline-ready
    }
    return { card, note, globi, photoUrl, photoFile };
  } catch { return null; }
}

// keep the CURRENT ecoregion's queue at 100 in 25-card batches. Failures are
// silent = offline; retried on the next trigger (home mount, pack open,
// ecoregion change, home retry tap).
export async function topUp() {
  if (_topping) return;
  _topping = true;
  try {
    await offlineReady();
    const eco = currentEco();
    if (!eco) return;
    const eid = eco.eid;
    await loadQueue(eid);
    const q = _queues[eid];
    while (q.length < QUEUE_TARGET) {
      await loadCatalog();   // rejects offline → ride on what we have
      const fresh = drawFresh(eid, Math.min(BATCH, QUEUE_TARGET - q.length));
      if (!fresh.length) break;
      const stashed = (await Promise.all(fresh.map(prep))).filter((s): s is Stashed => !!s);
      if (!stashed.length) break;   // every download failing → connection died
      stashed.forEach(register);
      q.push(...stashed);
      await persistQueue(eid);
    }
    // heal: owned cards missing their snapshot (app died mid-collect)
    for (const o of allOwned()) {
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

// swipe LEFT: release — drop the photo file unless some deck or queue still
// needs it
export function releaseStashed(s: Stashed) {
  const sid = s.card.species_id;
  if (!canFS || !s.photoFile || ownsAnywhere(sid) || _snaps[sid]) return;
  if (Object.values(_queues).some(q => q.some(x => x.card.species_id === sid))) return;
  unregisterLocalPhoto(s.card.id);
  try { new File(photosDir(), s.photoFile).delete(); } catch { /* already gone */ }
}
