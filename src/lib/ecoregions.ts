// Ecoregions are the app's unit of play (decided 2026-09-26): you pick the
// ecoregion you're in on a map, the daily pack draws from ITS species, and
// your collection is a separate deck per ecoregion (the same species can be
// collected again somewhere else). Membership comes straight from the
// catalog — every card carries its RESOLVE ecoregion ids in `ecoregions`.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Card, getCards, photoFor } from './catalog';

export type EcoMeta = { name: string; bbox: [number, number, number, number]; obs?: number };
// size = deck size at the time of choosing, so the home stats work offline.
// names = the ecoregion's LOCAL species names (sid → name, only where they
// differ from the English default; user 2026-09-26: "a cougar should be called
// the local name for a cougar there so the card is unique"), persisted so the
// deck reads the same offline. lang = the language those names are in.
export type CurrentEco = {
  eid: number; name: string; bbox: [number, number, number, number]; size: number;
  lang?: string; names?: Record<string, string>;
};

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

// the site ships one small file per ecoregion that has local names
// (data/eco_names/<eid>.json = {lang, names}); 404 = English everywhere
const NAMES_URL = (eid: number) => `https://polygrovedb.pages.dev/data/eco_names/${eid}.json`;
export async function fetchEcoNames(eid: number): Promise<{ lang?: string; names: Record<string, string> }> {
  const r = await fetch(NAMES_URL(eid));
  if (r.status === 404) return { names: {} };
  if (!r.ok) throw new Error(`eco_names ${r.status}`);
  return r.json();
}
// fill in the current ecoregion's names if they were never fetched (chosen
// offline, or before this feature existed); silent when offline
export async function ensureEcoNames() {
  const eco = _current;
  if (!eco || eco.names) return;
  try {
    const { lang, names } = await fetchEcoNames(eco.eid);
    if (_current?.eid === eco.eid) await setCurrentEco({ ...eco, lang, names });
  } catch { /* offline — next time */ }
}

export const LANG_NAMES: Record<string, string> = {
  es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', nl: 'Dutch', it: 'Italian',
  sv: 'Swedish', da: 'Danish', fo: 'Faroese', no: 'Norwegian', fi: 'Finnish', is: 'Icelandic',
  et: 'Estonian', lv: 'Latvian', lt: 'Lithuanian', pl: 'Polish', cs: 'Czech', sk: 'Slovak',
  hu: 'Hungarian', sl: 'Slovene', hr: 'Croatian', ro: 'Romanian', tr: 'Turkish', ca: 'Catalan',
  id: 'Indonesian', ms: 'Malay', vi: 'Vietnamese', sw: 'Swahili',
};

// the card as it's called HERE: local name up front, the English name kept as
// nameEn so the card can still say what it is
export function localize(card: Card, eco: CurrentEco | null = _current): Card {
  const local = eco?.names?.[String(card.species_id)];
  if (!local || local === card.name) return card;
  return { ...card, name: local, nameEn: card.name };
}
export const localName = (card: Card, eco: CurrentEco | null = _current) =>
  eco?.names?.[String(card.species_id)] || card.name;

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
  const m = all.filter(c => (c.ecoregions as number[] | undefined)?.includes(eid) && photoFor(c.id));
  _members[eid] = m;
  return m;
}
export const ecoDeckSize = (eid: number) => ecoMembers(eid).length;
