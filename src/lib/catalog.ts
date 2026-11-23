// PolygroveDB content contract — the app owns NO species data. It fetches the
// same catalog the explorer ships, from the deployed site (the free content API).
// Key all user state by species_id (stable GBIF id), never by the slug: slugs
// follow common names and a rename would orphan progress (decided 2026-09-24).

import { DB_SITE } from '../constants/site';

export type FoodwebLink = { name: string; evidence: number; card: boolean; inSet: boolean };
export type Card = {
  id: string;              // slug — display + routing only
  species_id: number;      // THE stable key for user state
  name: string;
  sci: string;
  levels: number;
  group: string;
  trophic: string;         // Producer | Decomposer | Herbivore | Omnivore | Carnivore
  role?: string;
  size?: string | null;
  habitat?: string | null;
  origin?: string | null;
  biome?: string | null;
  slot5?: string | null;
  slot5type?: string | null;
  foodweb?: { eats: FoodwebLink[]; eatenBy: FoodwebLink[] };
  lookAlikes?: string[];
  provenance?: Record<string, { source: string; confidence: string }>;
  [k: string]: unknown;    // quiz payloads (q3/q4/...) ride along untyped for now
};

const BASE = `${DB_SITE}/data`;

let _cards: Card[] | null = null;
let _photos: Record<string, string> = {};
// iNATURALIST FILL-INS (2026-10-08, of a blank "Acantholycosa pedestris" card):
// for a card Wikipedia has no lead image for, a licensed iNaturalist taxon
// photo — CC0, CC BY or CC BY-SA only — with its page, credit and licence.
// Built by polygrovedb's fetch_inat_taxa.py into data/inat_photos.json.
// ONLY FOR THE POLYGROVEDB TAB (user, 2026-10-08: "make sure that none of the
// cards you collect have iNaturalist photos, only the DB"): photoFor() — the
// deck, packs, the journal, sightings, the quiz — never sees them; photoForDb()
// does, for the database list and its species pages.
export type InatPhoto = { url: string; page: string; by: string; lic: string };
let _inat: Record<string, InatPhoto> = {};
// QUIZ OPTIONS THAT ARE NOT CARDS (user, 2026-10-08: "species on the quizzes that only
// have an iNat photo will show up on answers … a lot of missing photos there"): a
// food-web option can be any species the records name. data/option_photos.json has a
// licensed iNaturalist photo for those, keyed by the name the option shows.
let _optPhoto: Record<string, InatPhoto> = {};
/** an ANSWER OPTION's picture: the card's Wikipedia photo, else an iNaturalist one. Options are not collected, so iNaturalist is allowed here. */
export function optionPhoto(name: string): { uri: string; id?: string; credit?: InatPhoto } | undefined {
  const c = _byName[name.toLowerCase()];
  if (c) { const w = photoFor(c.id, 250); if (w) return { uri: w, id: c.id }; const i = _inat[c.id]; return i ? { uri: i.url, credit: i } : undefined; }
  const o = _optPhoto[name];
  return o ? { uri: o.url, credit: o } : undefined;
}
// A SECOND PHOTO for the quiz's last question (user, 2026-10-18: "don't put the
// original photo of the animal if we can, put a second photo of the species"):
// "Is this your card?" showed the card's own picture, so remembering the image
// was enough. data/second_photos.json (polygrovedb's fetch_second_photos.py) has
// another licensed iNaturalist photo of the species, never the one on the card.
// Quiz cards are not collected, so iNaturalist is allowed here, as for options.
let _second: Record<string, InatPhoto> = {};
export const secondPhotoOf = (id: string): InatPhoto | undefined => _second[id];
export const inatPhotoOf = (id: string): InatPhoto | undefined => (_photos[id] ? undefined : _inat[id]);
// how each photo sits in the card's hexagon (framing.json — only the cards
// whose subject a centre crop would cut): [aspect, scale, cx, cy]
export type Frame = [number, number, number, number];
let _framing: Record<string, Frame> = {};
let _byName: Record<string, Card> = {};
let _inflight: Promise<{ cards: Card[]; photos: Record<string, string> }> | null = null;

export function loadCatalog(onStage?: (s: string) => void) {
  if (_cards) return Promise.resolve({ cards: _cards, photos: _photos });
  // a failed fetch must NOT poison the cache — clear it so the next call
  // (home retry, queue top-up when signal returns) refetches
  _inflight ||= (async () => {
    onStage?.('Downloading the deck…');
    // the Q3/Q4 quiz payloads live in quiz.json beside the catalog (2026-10-05:
    // the catalog outgrew Cloudflare Pages' 25 MiB file cap); they go back on
    // each card here, so the rest of the app sees one shape
    const [cards, quiz] = await Promise.all([
      fetch(`${BASE}/catalog.json`).then(r => { if (!r.ok) throw new Error(`catalog ${r.status}`); return r.json() as Promise<Card[]>; }),
      fetch(`${BASE}/quiz.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<Record<string, Partial<Card>>>,
    ]);
    for (const c of cards) { const q = quiz[c.id]; if (q) Object.assign(c, q); }
    onStage?.('Fetching photos…');
    const [photos, inat] = await Promise.all([fetchPhotos(), fetchInat()]);   // together: deck membership reads both
    fetch(`${BASE}/second_photos.json`).then(r => (r.ok ? r.json() : {})).then((o: Record<string, InatPhoto>) => { _second = o || {}; }).catch(() => {});
    fetch(`${BASE}/option_photos.json`).then(r => (r.ok ? r.json() : {})).then((o: Record<string, InatPhoto>) => { _optPhoto = o || {}; }).catch(() => {});
    // a failed photo index must not stick (2026-10-06: a sheet read "37 / 0
    // species in deck" — with no index every deck counted as empty, while the
    // journaled cards still showed from their on-disk photos): retry quietly
    if (!Object.keys(photos).length) retryPhotos();
    // SOUNDS (user, 2026-10-06): data/audio.json — up to three licensed recordings
    // (CC0 / CC-BY, from iNaturalist and Cornell via GBIF) per species, by
    // scientific name. Linked, never copied. A nicety like framing.
    fetch(`${BASE}/audio.json`).then(r => (r.ok ? r.json() : {})).then((a: Record<string, Sound[]>) => { _audio = a || {}; }).catch(() => {});
    // framing is a nicety: without it photos fall back to the centre crop
    fetch(`${BASE}/framing.json`).then(r => (r.ok ? r.json() : {})).then((f: Record<string, Frame>) => { _framing = f || {}; }).catch(() => {});
    _cards = cards; _photos = photos; _inat = inat;
    _byName = Object.fromEntries(cards.map(c => [c.name.toLowerCase(), c]));
    return { cards, photos };
  })().catch(e => { _inflight = null; throw e; });
  return _inflight;
}

// ── offline registration (offline.ts): queued/snapshotted cards stay fully
// usable with NO catalog fetch — cardById and the photo helpers consult these
// side maps, and photoFor prefers the on-disk file when one exists.
const _extra: Record<string, Card> = {};
const _localPhoto: Record<string, string> = {};      // id → file:// uri
const _extraPhotoUrl: Record<string, string> = {};   // id → CDN thumb (commons link)
const _extraFrame: Record<string, Frame> = {};       // id → framing, kept with the stash
export function registerOfflineCard(card: Card, localUri?: string, photoUrl?: string, frame?: Frame) {
  _extra[card.id] = card;
  if (localUri) _localPhoto[card.id] = localUri;
  if (photoUrl) _extraPhotoUrl[card.id] = photoUrl;
  if (frame) _extraFrame[card.id] = frame;
}
// the site's current framing wins; the stashed copy serves offline
export const framingFor = (id: string): Frame | undefined => _framing[id] ?? _extraFrame[id];
export function unregisterLocalPhoto(id: string) { delete _localPhoto[id]; }

export type Sound = { url: string; by: string; lic: string; ds: string };
let _audio: Record<string, Sound[]> = {};
export const soundsFor = (sci: string): Sound[] => _audio[sci] ?? [];
export const getCards = () => _cards ?? [];
const fetchPhotos = (): Promise<Record<string, string>> => fetch(`${BASE}/photos.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
const fetchInat = (): Promise<Record<string, InatPhoto>> => fetch(`${BASE}/inat_photos.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
let _photoRetry = 0;
function retryPhotos() {
  if (_photoRetry++ > 5) return;
  setTimeout(() => fetchPhotos().then(p => { if (Object.keys(p).length) { _photos = p; _photoListeners.forEach(l => l()); } else retryPhotos(); }), 4000 * _photoRetry);
}
/** true once the photo index has arrived (deck membership depends on it) */
export const photosLoaded = () => Object.keys(_photos).length > 0;
const _photoListeners = new Set<() => void>();
export const onPhotosLoaded = (l: () => void) => { _photoListeners.add(l); return () => { _photoListeners.delete(l); }; };
// indexed (2026-10-06): the Sightings combs call this thousands of times a
// render; a scan of 14,713 cards each time made the screen crawl
let _byId: Record<string, Card> = {}, _byIdOf: Card[] | null = null;
export const cardById = (id: string) => {
  if (_byIdOf !== _cards) { _byId = Object.fromEntries((_cards ?? []).map(c => [c.id, c])); _byIdOf = _cards ?? null; }
  return _byId[id] ?? _extra[id];
};
export const cardByName = (n: string) => _byName[n.toLowerCase()];

// Wikimedia thumb URLs are resizable by rewriting the /NNNpx- segment — but the
// thumb.wikimedia.org CDN only serves FIXED buckets (others 400): snap up.
const THUMB_BUCKETS = [120, 250, 330, 500, 960, 1280];
export function photoFor(id: string, px = 120): string | undefined {
  if (_localPhoto[id]) return _localPhoto[id];   // on-disk snapshot/queue photo
  return photoRemote(id, px);
}
// the CDN url regardless of any on-disk copy (offline.ts downloads + commons)
export function photoRemote(id: string, px = 120): string | undefined {
  const u = _photos[id] || _extraPhotoUrl[id];
  if (!u) return undefined;
  const bucket = THUMB_BUCKETS.find(b => b >= px) ?? 1280;
  return u.replace(/\/\d+px-/, `/${bucket}px-`);
}
/** the DB tab's photo: Wikipedia's, else the iNaturalist fill-in (served as it is, 500 px) */
export function photoForDb(id: string, px = 120): string | undefined {
  return photoFor(id, px) ?? _inat[id]?.url;
}

// the photo's Wikimedia Commons file page — the attribution/license source.
// thumb URLs look like .../commons/thumb/2/2f/<Filename>/120px-<Filename>?...
export function photoCommonsPage(id: string): string | undefined {
  const u = _photos[id] || _extraPhotoUrl[id];
  const m = u?.match(/\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//);
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : _inat[id]?.page;   // or the iNaturalist photo page, credited there
}

// SIZE IN CONTEXT (user, 2026-10-06: "a bar indicating the minimum of its
// taxonomy to the maximum and a progress bar of its size"): where a card's
// size sits among every card of the same group measured in the same unit.
// Sizes span orders of magnitude (a 2 g hummingbird, a 190 t whale), so the
// position is on a log scale. Ranges are built once per group+unit.
export type SizeVal = { v: number; unit: 'cm' | 'mm' | 'g' };
export function parseSize(size?: string | null): SizeVal | null {
  const m = /^\s*([\d.,]+)\s*(cm|mm|g)\b/.exec(size || '');
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(v) && v > 0 ? { v, unit: m[2] as SizeVal['unit'] } : null;
}
const _ranges = new Map<string, { min: number; max: number } | null>();
export function sizeRange(group: string, unit: SizeVal['unit']): { min: number; max: number } | null {
  const key = `${group}|${unit}`;
  if (_ranges.has(key)) return _ranges.get(key)!;
  let min = Infinity, max = -Infinity, n = 0;
  for (const c of getCards()) {
    if (c.group !== group) continue;
    const sz = parseSize(c.size);
    if (!sz || sz.unit !== unit) continue;
    if (sz.v < min) min = sz.v; if (sz.v > max) max = sz.v; n++;
  }
  const r = n >= 3 && max > min ? { min, max } : null;
  _ranges.set(key, r);
  return r;
}
/** 0..1 on a log scale between the group's smallest and largest */
export const sizeFrac = (v: number, r: { min: number; max: number }) =>
  Math.max(0, Math.min(1, (Math.log(v) - Math.log(r.min)) / (Math.log(r.max) - Math.log(r.min))));
/** short, human: 2.4 g · 1.2 kg · 190 t · 35 cm · 11 m · 85 mm */
export function fmtSize(v: number, unit: SizeVal['unit']): string {
  const f = (x: number) => (x >= 100 ? Math.round(x).toLocaleString() : x >= 10 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, ''));
  if (unit === 'g') return v >= 1e6 ? `${f(v / 1e6)}t` : v >= 1000 ? `${f(v / 1000)}kg` : `${f(v)}g`;
  if (unit === 'cm') return v >= 100 ? `${f(v / 100)}m` : `${f(v)}cm`;
  return v >= 10 ? `${f(v / 10)}cm` : `${f(v)}mm`;
}
/** the same size in imperial (user, 2026-10-06: "put imperial numbers to the right of metric") */
export function fmtImperial(v: number, unit: SizeVal['unit']): string {
  const f = (x: number, d = 1) => (x >= 100 ? Math.round(x).toLocaleString() : x >= 10 ? x.toFixed(0) : x.toFixed(d).replace(/\.0$/, ''));
  if (unit === 'g') {
    const oz = v / 28.3495, lb = v / 453.592;
    if (lb >= 2000) { const t = f(lb / 2000); return `${t}${t === "1" ? "ton" : "tons"}`; }
    return lb >= 1 ? `${f(lb)}lb` : `${f(oz, oz < 1 ? 2 : 1)}oz`;
  }
  const inches = unit === 'cm' ? v / 2.54 : v / 25.4;
  if (inches >= 12) { const ft = inches / 12; return ft >= 100 ? `${f(ft)} ft` : `${f(ft)} ft`; }
  return `${f(inches, inches < 1 ? 2 : 1)}in`;
}
