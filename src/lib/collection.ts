// On-device collection. KEYED BY species_id (the stable GBIF id) — never the
// slug, so catalog rebuilds/renames can't orphan anyone's cards (2026-09-24).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Card } from './catalog';

export type Owned = { speciesId: number; id: string; name: string; at: number };

const KEY = 'polygrove.collection.v1';
let _col: Record<number, Owned> = {};
let _loaded = false;
const listeners = new Set<() => void>();
let _snapshot: Owned[] = [];

function emit() {
  _snapshot = Object.values(_col).sort((a, b) => b.at - a.at);
  listeners.forEach(l => l());
}

export async function loadCollection() {
  if (_loaded) return _col;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) _col = JSON.parse(raw);
  } catch { /* fresh start */ }
  _loaded = true;
  emit();
  return _col;
}

async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(_col)); } catch { /* best effort */ }
}

export function addToCollection(card: Card): boolean {
  const isNew = !_col[card.species_id];
  _col[card.species_id] = { speciesId: card.species_id, id: card.id, name: card.name, at: Date.now() };
  emit();
  persist();
  return isNew;
}

export const owns = (speciesId: number) => !!_col[speciesId];
export const collectionCount = () => Object.keys(_col).length;

export function useCollection(): Owned[] {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => _snapshot,
    () => _snapshot,
  );
}
