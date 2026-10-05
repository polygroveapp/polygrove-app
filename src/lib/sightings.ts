// YOUR SIGHTINGS BECOME CARDS (user, 2026-10-05: Social is scrapped for now —
// "you choose which iNaturalist account is yours and you get the cards in the
// game if you observe them … in the ecoregion that you observed it at.
// Duplicates do nothing"). The rules, as decided:
//  · you say which iNaturalist account is yours (no sign-in yet — it is taken
//    on trust; real sign-in is waiting on iNaturalist's approval)
//  · only observations the iNaturalist community has CONFIRMED ("research
//    grade") count; the rest are shown as waiting
//  · a confirmed species that is a card joins the journal of the ecoregion
//    WHERE IT WAS SEEN (the observation's public location, looked up on the
//    phone) — free, no Sol
//  · already journaled there → nothing happens. A duplicate is never moved
//    to a nearby ecoregion or anywhere else.
//  · species you have seen that are not cards — or not in that ecoregion's
//    deck — are listed as POTENTIAL cards, with what is missing
//  · a card a sighting gave you is a CUSTOM card (user, same day): it wears
//    YOUR photo, and its field note is the observation — when, where, how
//    many people agreed — instead of the Wikipedia note. Waiting and
//    potential sightings can be previewed "as they could be", with whatever
//    facts the database has and the missing ones marked.
// Nothing here goes to a Polygrove server: the phone asks iNaturalist's
// public API for the account's observations and keeps the results itself.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Card, framingFor, getCards, loadCatalog, photoFor, photoRemote } from './catalog';
import { addToCollection, loadCollection, owns } from './collection';
import { loadEcoMeta } from './ecoregions';
import { Naturalist, Spot, gradedOf } from './inatPublic';
import { ecoregionAt } from './locate';
import { snapshotStashed } from './offline';

// one observation, as a card shows it
export type SightingInfo = {
  obsId: number; uri?: string; date: string | null; place?: string | null;
  photo?: string | null; credit?: string | null; agree?: number;
  seen?: number;          // confirmed sightings of this species in this ecoregion
  pending?: boolean;      // not confirmed yet
};
// the five things a card needs; the keys match the card's own fact slots
export type FactKey = 'feeding' | 'size' | 'foodweb' | 'slot5' | 'biome';
export type Facts = {
  group: string; trophic: string | null; size: string | null; habitat: string | null; origin: string | null; biome: string | null;
  edge: string | null;    // the database's best food-web line ("eats California Mouse")
  missing: FactKey[];
};
export type Earned = SightingInfo & { cardId: string; speciesId: number; name: string; eid: number; eco: string; at: number };
export type Waiting = SightingInfo & { name: string; sci: string; cardId: string | null; facts: Facts | null };
export type Potential = { key: string; name: string; sci: string; seen: number; why: string; cardId: string | null; facts: Facts | null; obs: SightingInfo };
type State = {
  v: number;
  me: Naturalist | null;
  earned: Earned[];            // cards your sightings gave you, newest first
  waiting: Waiting[]; waitingTotal: number;
  potential: Potential[]; potentialTotal: number;
  already: number;             // cards you had journaled there anyway, before any sighting
  unplaced: number;            // confirmed sightings of cards with no ecoregion at that spot
  confirmed: number;           // confirmed observations in all
  checkedAt: number;
  // WHERE you saw things — [lng, lat, confirmed 1|0] of every sighting with a
  // public spot — for the map's ✕ marks (user, 2026-10-05): yellow when the
  // community has confirmed it, green while it waits.
  // On the phone only, like everything else here.
  marks: [number, number, number][];
};
const V = 4;   // 2: sightings carry their photo and stats, lists carry facts · 3: marks · 4: marks say confirmed or waiting
const MAX_MARKS = 4000;
const EMPTY: State = { v: V, me: null, earned: [], waiting: [], waitingTotal: 0, potential: [], potentialTotal: 0, already: 0, unplaced: 0, confirmed: 0, checkedAt: 0, marks: [] };
type Run = { busy: boolean; step: string | null; fresh: Earned[] | null; err: string | null };

const KEY = 'polygrove.sightings.v1';
const PAGE = 200, MAX_PAGES = 50;   // iNaturalist serves the first 10,000 of a search
const KEEP = 300;                   // potential cards kept on the phone (the count is kept whole)
let _s: State = EMPTY;
let _run: Run = { busy: false, step: null, fresh: null, err: null };
let _loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(_s)).catch(() => { /* best effort */ });
const set = (patch: Partial<State>) => { _s = { ..._s, ...patch }; emit(); save(); };
const run = (patch: Partial<Run>) => { _run = { ..._run, ...patch }; emit(); };

export function loadSightings() {
  _loaded ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const old = JSON.parse(raw);
        // an older shape: keep who you are and what you earned, and look
        // everything else up again (checkedAt 0 = check on the next visit)
        _s = old.v === V ? { ...EMPTY, ...old } : { ...EMPTY, me: old.me ?? null, earned: old.earned ?? [] };
      }
    } catch { /* fresh start */ }
    emit();
  })();
  return _loaded;
}
export function useSightings(): State { return useSyncExternalStore(subscribe, () => _s, () => _s); }
export function useSightingsRun(): Run { return useSyncExternalStore(subscribe, () => _run, () => _run); }
// the sighting behind a journaled card, if a sighting is how you got it
export const sightingIn = (earned: Earned[], eid: number | null | undefined, speciesId: number): Earned | undefined =>
  (eid == null ? undefined : earned.find(e => e.eid === eid && e.speciesId === speciesId));

// choosing or changing the account starts the lists over; cards already in
// your journals stay where they are
export function chooseMe(p: Naturalist) { _s = { ...EMPTY, me: p }; _run = { busy: _run.busy, step: null, fresh: null, err: null }; emit(); save(); }
export function forgetMe() { _s = EMPTY; _run = { busy: _run.busy, step: null, fresh: null, err: null }; emit(); save(); }

// iNaturalist serves each photo at several sizes; the lists use the small one
// (240 px). The medium (500 px) one on every row of a long list, drawn through
// SVG which does not downsample, was enough to have iOS kill the app for
// memory (user, 2026-10-05: "the app just crashed").
export const smallPhoto = (url: string | null | undefined) => (url ? url.replace('/medium.', '/small.') : undefined);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2025-10-31" → "31 Oct 2025"
export function niceDate(d: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : d ?? null;
}

// WHAT A NON-CARD HAS AND LACKS: the database's pool lists every species with
// at least four of a card's five facts — [sci, class, mask, feeding, size,
// habitat, origin, biome, food-web line] — and a mask of which it has
// (feeding 16 · size 8 · food web 4 · habitat/origin 2 · biome 1). A big
// file, fetched once a session and only when there is something to explain.
type PoolRow = [string, string, number, string | null, string | null, string | null, string | null, string | null, string | null];
let _pool: Promise<Map<string, PoolRow>> | null = null;
function loadPool() {
  _pool ||= fetch('https://polygrovedb.pages.dev/data/pool.json')
    .then(r => { if (!r.ok) throw new Error(`pool ${r.status}`); return r.json(); })
    .then((rows: PoolRow[]) => new Map(rows.map(r => [String(r[0]).toLowerCase(), r])))
    .catch(e => { _pool = null; throw e; });
  return _pool;
}
const BITS: [number, FactKey, string][] = [[16, 'feeding', 'feeding role'], [8, 'size', 'size'], [4, 'foodweb', 'food web'], [2, 'slot5', 'habitat or origin'], [1, 'biome', 'biome']];
export const FACT_LABEL: Record<FactKey, string> = { feeding: 'feeding role', size: 'size', foodweb: 'food web', slot5: 'habitat or origin', biome: 'biome' };
const listOf = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const NOTHING: Facts = { group: '', trophic: null, size: null, habitat: null, origin: null, biome: null, edge: null, missing: BITS.map(b => b[1]) };
function factsOf(row: PoolRow | undefined): Facts {
  if (!row) return NOTHING;
  const mask = Number(row[2]) || 0;
  return {
    group: row[1] || '', trophic: row[3] ?? null, size: row[4] ?? null, habitat: row[5] ?? null, origin: row[6] ?? null,
    biome: row[7] ?? null, edge: row[8] ?? null, missing: BITS.filter(([bit]) => !(mask & bit)).map(b => b[1]),
  };
}
const whyOf = (row: PoolRow | undefined, f: Facts) =>
  (!row ? 'not enough is known about it yet' : f.missing.length ? `needs its ${listOf(f.missing.map(k => FACT_LABEL[k]))}` : 'has its facts — still needs a photo or a check');

const info = (o: Spot, extra?: Partial<SightingInfo>): SightingInfo =>
  ({ obsId: o.id, uri: o.uri, date: o.date, place: o.place, photo: o.photo, credit: o.credit, agree: o.agree, ...extra });
const pause = () => new Promise<void>(r => setTimeout(r, 0));

let _syncing: Promise<void> | null = null;
export function syncSightings(): Promise<void> {
  if (_syncing) return _syncing;
  const me = _s.me;
  if (!me) return Promise.resolve();
  _syncing = (async () => {
    run({ busy: true, step: 'Asking iNaturalist…', err: null });
    const fresh: Earned[] = [];
    const startEarned = _s.earned;
    // pairs (ecoregion:species) your sightings gave you on earlier checks
    const mine = new Set(startEarned.map(e => `${e.eid}:${e.speciesId}`));
    const marks: [number, number, number][] = [];
    // what is known so far is SAVED AS WE GO — after every page, and if the
    // check dies — so a long account (2,000 sightings, 2026-10-05) that fails
    // on page eight still has its cards and its ✕ marks on the map
    const partial = () => set({ earned: [...[...fresh].reverse(), ...startEarned].map(dress), marks: [...marks] });
    const seenAs = new Map<string, Spot[]>();   // every confirmed sighting behind each of those pairs
    // what the sighting says on its card: the one that earned it when it has a
    // photo to show, else the first that does
    const dress = (e: Earned): Earned => {
      const list = seenAs.get(`${e.eid}:${e.speciesId}`);
      if (!list?.length) return e;
      const best = list.find(o => o.id === e.obsId && o.photo) ?? list.find(o => o.photo) ?? list.find(o => o.id === e.obsId) ?? list[0];
      return { ...e, ...info(best), seen: list.length };
    };
    try {
      const [, meta] = await Promise.all([loadCatalog(), loadEcoMeta(), loadCollection()]);
      const bySci = new Map<string, Card>(getCards().map(c => [c.sci.toLowerCase(), c]));
      const had = new Set<string>();   // journaled there some other way (a pack) before any sighting
      const pot = new Map<string, Potential>();
      const bump = (key: string, o: Spot, sci: string, card: Card | undefined, why: string) => {
        const p = pot.get(key);
        if (!p) { pot.set(key, { key, name: card?.name ?? o.name, sci, seen: 1, why, cardId: card?.id ?? null, facts: null, obs: info(o) }); return; }
        p.seen += 1;
        if (!p.obs.photo && o.photo) p.obs = info(o);
      };
      let unplaced = 0, confirmed = 0, done = 0, skipped = 0;
      const mark = (o: Spot, ok: 0 | 1) => { if (o.lng != null && o.lat != null && marks.length < MAX_MARKS) marks.push([+o.lng.toFixed(4), +o.lat.toFixed(4), ok]); };

      for (let page = 1; page <= MAX_PAGES; page++) {
        const { list, total } = await gradedOf(me.id, 'research', page, PAGE);
        confirmed = total;
        for (const o of list) {
          done += 1;
          if (done % 40 === 0) { run({ step: `Placing sightings… ${done} of ${Math.min(total, PAGE * MAX_PAGES)}` }); await pause(); }
          if (_s.me?.id !== me.id) return;   // the account was changed mid-check
          mark(o, 1);
          if (!o.sci) continue;              // not identified to a species
          const card = bySci.get(o.sci.toLowerCase());
          if (!card) { bump(o.sci.toLowerCase(), o, o.sci, undefined, ''); continue; }
          let eid: number | null = null;
          if (o.lng != null && o.lat != null) {
            // an outline that will not download skips THIS sighting (it is
            // looked at again next check) rather than ending the whole check
            try { eid = await ecoregionAt(o.lng, o.lat); }
            catch { skipped += 1; continue; }
          }
          if (eid == null) { unplaced += 1; continue; }
          const eco = meta[String(eid)]?.name ?? 'that ecoregion';
          const inDeck = ((card.ecoregions as number[] | undefined) ?? []).includes(eid) && !!photoFor(card.id);
          if (!inDeck) { bump(`${card.species_id}@${eid}`, o, card.sci, card, `a card, but not in the deck for ${eco} yet`); continue; }
          const pair = `${eid}:${card.species_id}`;
          if (mine.has(pair)) { (seenAs.get(pair) ?? seenAs.set(pair, []).get(pair)!).push(o); continue; }   // a duplicate does nothing
          if (owns(eid, card.species_id)) { had.add(pair); continue; }                                       // …nor does one you had anyway
          mine.add(pair); seenAs.set(pair, [o]);
          addToCollection(eid, card);
          // journaled cards are readable offline forever: photo, note and food web are fetched and kept
          snapshotStashed({ card, note: null, globi: [], photoUrl: photoRemote(card.id, 500), frame: framingFor(card.id) });
          fresh.push({ ...info(o), cardId: card.id, speciesId: card.species_id, name: card.name, eid, eco, at: Date.now() });
        }
        partial();
        if (list.length < PAGE) break;
      }

      run({ step: 'Checking what is still waiting…' });
      const w = await gradedOf(me.id, 'needs_id', 1, PAGE);
      w.list.forEach(o => mark(o, 0));
      const waiting: Waiting[] = w.list.filter(o => o.sci).reverse().map(o => {
        const card = bySci.get((o.sci as string).toLowerCase());
        return { ...info(o, { pending: true }), name: card?.name ?? o.name, sci: o.sci as string, cardId: card?.id ?? null, facts: null };
      });

      // what each non-card has, and why it isn't one yet
      const blankP = [...pot.values()].filter(p => !p.cardId), blankW = waiting.filter(x => !x.cardId);
      if (blankP.length || blankW.length) {
        try {
          const pool = await loadPool();
          for (const p of blankP) { const row = pool.get(p.sci.toLowerCase()); p.facts = factsOf(row); p.why = whyOf(row, p.facts); }
          for (const x of blankW) x.facts = factsOf(pool.get(x.sci.toLowerCase()));
        } catch { for (const p of blankP) p.why = 'not a card yet'; }
      }

      if (_s.me?.id !== me.id) return;
      const potential = [...pot.values()].sort((a, b) => b.seen - a.seen || a.name.localeCompare(b.name));
      set({
        earned: [...[...fresh].reverse(), ..._s.earned].map(dress),
        waiting, waitingTotal: w.total,
        potential: potential.slice(0, KEEP), potentialTotal: potential.length,
        already: had.size, unplaced, confirmed, checkedAt: Date.now(), marks,
      });
      run({ fresh, err: skipped ? `${skipped} sighting${skipped === 1 ? '' : 's'} couldn’t be placed this time — they’ll be tried again on the next check.` : null });
    } catch (e) {
      // cards journaled before the connection dropped are kept and listed, and so are the marks
      if (_s.me?.id === me.id) { partial(); if (fresh.length) run({ fresh }); }
      const msg = String((e as Error)?.message ?? '');
      run({ err: /iNaturalist answered 429/.test(msg) ? 'iNaturalist is asking us to slow down — wait a minute, then check again.'
        : /iNaturalist/.test(msg) ? 'iNaturalist can’t be reached right now — try again in a bit.'
        : 'The map data can’t be reached right now — try again in a bit.' });
    } finally {
      run({ busy: false, step: null });
      _syncing = null;
    }
  })();
  return _syncing;
}
