// CUSTOM CARDS (Social; user, 2026-10-05: "remove the idea that you get the
// card in the base game. right now we are creating custom cards for each
// observation"). Buying a sighting no longer puts the species' deck card in a
// journal: it makes a card OF THAT OBSERVATION — the observer's photo, what
// they saw, when and where, their credit — kept in a collection of its own.
// Custom cards are outside the base game: no ecoregion journal, no mastery,
// no quiz, and they never mark an ecoregion as visited.
// Kept on this phone only; nothing is sent anywhere, and the observer is not
// told. A sighting can only become a card when its photo carries a licence.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Sighting } from './inatPublic';
import { sol, spendSol } from './sol';

export const CARD_PRICE = 10;

export type CustomCard = {
  id: number;                 // the iNaturalist observation id — one card per observation
  uri: string;
  name: string; sci: string | null;
  photo: string; credit: string | null; license: string | null;
  date: string | null; place: string | null;
  by: Sighting['by'];
  at: number;                 // when it was bought
};

const KEY = 'polygrove.custom.v1';
let _list: CustomCard[] = [];
let _loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(_list)).catch(() => { /* best effort */ });
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function loadCustom() {
  _loaded ||= (async () => {
    try { const raw = await AsyncStorage.getItem(KEY); if (raw) _list = JSON.parse(raw) || []; } catch { /* fresh start */ }
    emit();
  })();
  return _loaded;
}

// the card view wants more pixels than the list thumbnail
export const bigPhoto = (url: string) => url.replace('/medium.', '/large.');

// subscribed reads: with the React Compiler on, a plain lookup during render
// is memoized away and a purchase would not show
export function useCustomCards(): CustomCard[] {
  return useSyncExternalStore(subscribe, () => _list, () => _list);
}
export function useCustomCard(id: number | null | undefined): CustomCard | undefined {
  const list = useCustomCards();
  return id == null ? undefined : list.find(c => c.id === id);
}

export type Bought = { ok: true; card: CustomCard } | { ok: false; reason: 'sol' | 'owned' | 'photo' };

export function buyObservation(s: Sighting): Bought {
  if (!s.photo) return { ok: false, reason: 'photo' };
  if (_list.some(c => c.id === s.id)) return { ok: false, reason: 'owned' };
  if (sol() < CARD_PRICE) return { ok: false, reason: 'sol' };
  spendSol(CARD_PRICE);
  const card: CustomCard = {
    id: s.id, uri: s.uri, name: s.name, sci: s.sci, photo: s.photo, credit: s.credit, license: s.license,
    date: s.date, place: s.place, by: s.by, at: Date.now(),
  };
  _list = [card, ..._list];
  emit(); save();
  return { ok: true, card };
}
