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
let _byName: Record<string, Card> = {};
let _inflight: Promise<{ cards: Card[]; photos: Record<string, string> }> | null = null;

export function loadCatalog(onStage?: (s: string) => void) {
  if (_cards) return Promise.resolve({ cards: _cards, photos: _photos });
  // a failed fetch must NOT poison the cache — clear it so the next call
  // (home retry, queue top-up when signal returns) refetches
  _inflight ||= (async () => {
    onStage?.('Downloading the deck…');
    const cards: Card[] = await fetch(`${BASE}/catalog.json`).then(r => {
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      return r.json();
    });
    onStage?.('Fetching photos…');
    const photos: Record<string, string> = await fetch(`${BASE}/photos.json`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}));
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
export function registerOfflineCard(card: Card, localUri?: string, photoUrl?: string) {
  _extra[card.id] = card;
  if (localUri) _localPhoto[card.id] = localUri;
  if (photoUrl) _extraPhotoUrl[card.id] = photoUrl;
}
export function unregisterLocalPhoto(id: string) { delete _localPhoto[id]; }

export const getCards = () => _cards ?? [];
export const cardById = (id: string) => _cards?.find(c => c.id === id) ?? _extra[id];
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
