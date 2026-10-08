// On-device collection — ONE DECK PER ECOREGION (2026-09-26): the same
// species can be collected again in another ecoregion. Inside a deck, cards
// are KEYED BY species_id (the stable GBIF id) — never the slug, so catalog
// rebuilds/renames can't orphan anyone's cards (2026-09-24).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Card } from './catalog';

export type Owned = { speciesId: number; id: string; name: string; at: number };
type Decks = Record<number, Record<number, Owned>>;   // eid → sid → Owned

const KEY = 'polygrove.collection.v2';
let _decks: Decks = {};
let _loaded = false;
let _inflight: Promise<Decks> | null = null;
const listeners = new Set<() => void>();
// per-eco sorted snapshots, rebuilt on change (useSyncExternalStore needs
// referentially stable results)
let _snaps: Record<number, Owned[]> = {};
const EMPTY: Owned[] = [];

let _version = 0;   // bumps on every change, in any deck
function emit() {
  _version++;
  _snaps = {};
  for (const eid of Object.keys(_decks)) {
    _snaps[+eid] = Object.values(_decks[+eid]).sort((a, b) => b.at - a.at);
  }
  listeners.forEach(l => l());
}

export function loadCollection() {
  if (_loaded) return Promise.resolve(_decks);
  _inflight ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) _decks = JSON.parse(raw);
    } catch { /* fresh start */ }
    _loaded = true;
    emit();
    return _decks;
  })();
  return _inflight;
}

async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(_decks)); } catch { /* best effort */ }
}

export function addToCollection(eid: number, card: Card): boolean {
  const deck = (_decks[eid] ||= {});
  const isNew = !deck[card.species_id];
  deck[card.species_id] = { speciesId: card.species_id, id: card.id, name: card.name, at: Date.now() };
  emit();
  persist();
  return isNew;
}

export const owns = (eid: number, speciesId: number) => !!_decks[eid]?.[speciesId];
/** when the card was journaled there (ms), 0 if it isn't */
export const ownedAt = (eid: number, speciesId: number) => _decks[eid]?.[speciesId]?.at ?? 0;
export const ownsAnywhere = (speciesId: number) =>
  Object.values(_decks).some(deck => !!deck[speciesId]);
export const collectionCount = (eid: number) => Object.keys(_decks[eid] || {}).length;
// every ecoregion with at least one card — the map outlines them in gold
export const collectedEcoregions = (): number[] =>
  Object.keys(_decks).map(Number).filter(eid => Object.keys(_decks[eid]).length > 0);
// every owned entry across all decks (offline heal pass)
export const allOwned = (): Owned[] => Object.values(_decks).flatMap(d => Object.values(d));

// "is this species in THAT deck?" for a screen that looks across decks
// (Social buys into whichever ecoregion a card belongs to). Subscribed, so the
// answer is a real dependency of the render — a plain owns() call during
// render is invisible to React and to its compiler's memoization.
export function useOwns(eid: number | null | undefined, speciesId: number | null | undefined): boolean {
  useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => _version, () => _version);
  return eid != null && speciesId != null && !!_decks[eid]?.[speciesId];
}

export function useCollection(eid: number | null | undefined): Owned[] {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => (eid == null ? EMPTY : _snaps[eid] || EMPTY),
    () => (eid == null ? EMPTY : _snaps[eid] || EMPTY),
  );
}
