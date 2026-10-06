// PolygroveDB content contract — the app owns NO species data. It fetches the
// same catalog the explorer ships, from the deployed site (the free content API).
// Key all user state by species_id (stable GBIF id), never by the slug: slugs
// follow common names and a rename would orphan progress (decided 2026-09-24).

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

const BASE = 'https://polygrovedb.pages.dev/data';

let _cards: Card[] | null = null;
let _photos: Record<string, string> = {};
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
    const photos: Record<string, string> = await fetch(`${BASE}/photos.json`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    // SOUNDS (user, 2026-10-06): data/audio.json — up to three licensed recordings
    // (CC0 / CC-BY, from iNaturalist and Cornell via GBIF) per species, by
    // scientific name. Linked, never copied. A nicety like framing.
    fetch(`${BASE}/audio.json`).then(r => (r.ok ? r.json() : {})).then((a: Record<string, Sound[]>) => { _audio = a || {}; }).catch(() => {});
    // framing is a nicety: without it photos fall back to the centre crop
    fetch(`${BASE}/framing.json`).then(r => (r.ok ? r.json() : {})).then((f: Record<string, Frame>) => { _framing = f || {}; }).catch(() => {});
    _cards = cards; _photos = photos;
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

// the photo's Wikimedia Commons file page — the attribution/license source.
// thumb URLs look like .../commons/thumb/2/2f/<Filename>/120px-<Filename>?...
export function photoCommonsPage(id: string): string | undefined {
  const u = _photos[id] || _extraPhotoUrl[id];
  const m = u?.match(/\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//);
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : undefined;
}
