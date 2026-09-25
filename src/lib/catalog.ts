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
  [k: string]: unknown;    // quiz payloads (q3/q4/...) ride along untyped for now
};

const BASE = 'https://polygrovedb.pages.dev/data';

let _cards: Card[] | null = null;
let _photos: Record<string, string> = {};
let _byName: Record<string, Card> = {};
let _inflight: Promise<{ cards: Card[]; photos: Record<string, string> }> | null = null;

export function loadCatalog(onStage?: (s: string) => void) {
  if (_cards) return Promise.resolve({ cards: _cards, photos: _photos });
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
  })();
  return _inflight;
}

export const getCards = () => _cards ?? [];
export const cardById = (id: string) => _cards?.find(c => c.id === id);
export const cardByName = (n: string) => _byName[n.toLowerCase()];

// Wikimedia thumb URLs are resizable by rewriting the /NNNpx- segment
export function photoFor(id: string, px = 120): string | undefined {
  const u = _photos[id];
  return u ? u.replace(/\/\d+px-/, `/${px}px-`) : undefined;
}
