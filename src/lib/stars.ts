// STARRED CARDS (user, 2026-10-06: "a fourth box to the right with just a
// star icon. if a card is starred, filter by only the cards that are
// starred"): the ☆ on a card marks it; the journal can show just those.
// On the phone only, like every other preference.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'polygrove.stars.v1';
let _stars: Set<string> | null = null;
let _snapshot: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const emit = () => { _snapshot = new Set(_stars ?? []); listeners.forEach(l => l()); };
let loading = false;
function load() {
  if (_stars || loading) return;
  loading = true;
  AsyncStorage.getItem(KEY).then(v => { _stars = new Set(v ? (JSON.parse(v) as string[]) : []); emit(); }).catch(() => { _stars = new Set(); emit(); });
}
const subscribe = (l: () => void) => { load(); listeners.add(l); return () => { listeners.delete(l); }; };
const EMPTY: ReadonlySet<string> = new Set();

export function toggleStar(cardId: string) {
  if (!_stars) _stars = new Set();
  if (_stars.has(cardId)) _stars.delete(cardId); else _stars.add(cardId);
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify([..._stars])).catch(() => {});
}
/** the set of starred card ids (a new Set object whenever it changes) */
export function useStars(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => _snapshot, () => EMPTY);
}
