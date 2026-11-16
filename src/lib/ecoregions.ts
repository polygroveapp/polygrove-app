// Ecoregions are the app's unit of play (decided 2026-09-26): you pick the
// ecoregion you're in on a map, the daily pack draws from ITS species, and
// your collection is a separate deck per ecoregion (the same species can be
// collected again somewhere else). Membership comes straight from the
// catalog — every card carries its RESOLVE ecoregion ids in `ecoregions`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Card, getCards, onPhotosLoaded, photoFor, photosLoaded } from './catalog';

// lead = the Wikipedia article's first sentence; photo = its lead image (CC/PD, credited)
export type EcoMeta = {
  name: string; bbox: [number, number, number, number]; obs?: number;
  lead?: string; photo?: { thumb: string; by: string; lic: string };
  wiki?: string;   // the Wikipedia article title
};
// size = deck size at the time of choosing, so the home stats work offline;
// lead + photo are copied in too so the home hero works offline (2026-09-28)
export type CurrentEco = {
  eid: number; name: string; bbox: [number, number, number, number]; size: number;
  lead?: string; photo?: EcoMeta['photo']; wiki?: string;
  // WHERE THE PIN STOOD when you pressed "Camp here" (user, 2026-11-16: "the pin is where
  // you camp and the species closest to it is what you will see"). A spot on the map the
  // player chose, never the device's location. Camps saved before this have none.
  spot?: { lng: number; lat: number };
};

/** the camp's spot: where the pin stood when you camped; for an older camp, the pin if it is still in the camp's ecoregion */
export function campSpot(camp: CurrentEco | null, pin: { lng: number; lat: number; eid: number | null } | null): { lng: number; lat: number } | null {
  if (!camp) return null;
  if (camp.spot) return camp.spot;
  return pin && pin.eid === camp.eid ? { lng: pin.lng, lat: pin.lat } : null;
}

const META_URL = 'https://polygrovedb.pages.dev/data/eco_meta.json';
export const ECO_GEOMETRY_URL = 'https://polygrovedb.pages.dev/data/eco_simple.geojson';
const KEY = 'polygrove.eco.v1';

let _meta: Record<string, EcoMeta> | null = null;
let _metaInflight: Promise<Record<string, EcoMeta>> | null = null;
let _current: CurrentEco | null = null;
let _loaded = false;
let _loadInflight: Promise<CurrentEco | null> | null = null;
const listeners = new Set<() => void>();

export function loadEcoMeta() {
  if (_meta) return Promise.resolve(_meta);
  _metaInflight ||= fetch(META_URL)
    .then(r => { if (!r.ok) throw new Error(`eco_meta ${r.status}`); return r.json(); })
    .then((m: Record<string, EcoMeta>) => { _meta = m; return m; })
    .catch(e => { _metaInflight = null; throw e; });
  return _metaInflight;
}
export const ecoMeta = (eid: number): EcoMeta | undefined => _meta?.[String(eid)];
// the dump-extracted leads carry pronunciation stubs like "( ; coast, shore)"
export const wikiUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
export const cleanLead = (t: string) => t.replace(/\s*\(\s*;[^)]*\)/g, '').replace(/\s*\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

// the chosen ecoregion is persisted WITH its name + bbox so home works offline
// without eco_meta
export function loadCurrentEco() {
  if (_loaded) return Promise.resolve(_current);
  _loadInflight ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) _current = JSON.parse(raw);
    } catch { /* fresh start */ }
    _loaded = true;
    listeners.forEach(l => l());
    return _current;
  })();
  return _loadInflight;
}

export const currentEco = () => _current;

export async function setCurrentEco(eco: CurrentEco) {
  _current = eco;
  listeners.forEach(l => l());
  try { await AsyncStorage.setItem(KEY, JSON.stringify(eco)); } catch { /* best effort */ }
}

export function useCurrentEco(): CurrentEco | null {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => _current,
    () => _current,
  );
}

// the ecoregion's deck — its catalog members that have a photo
const _members: Record<number, Card[]> = {};
export function ecoMembers(eid: number): Card[] {
  if (_members[eid]) return _members[eid];
  const all = getCards();
  if (!all.length) return [];
  // without the photo index every card would fail the photo test and the deck
  // would read empty — so until it arrives, membership is by ecoregion alone
  // and nothing is cached (the index's arrival clears the cache)
  const ready = photosLoaded();
  const m = all.filter(c => (c.ecoregions as number[] | undefined)?.includes(eid) && (!ready || photoFor(c.id)));
  if (ready) _members[eid] = m;
  return m;
}
onPhotosLoaded(() => { for (const k of Object.keys(_members)) delete _members[+k]; });
export const ecoDeckSize = (eid: number) => ecoMembers(eid).length;
