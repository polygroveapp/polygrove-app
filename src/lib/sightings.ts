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
// Nothing here goes to a Polygrove server: the phone asks iNaturalist's
// public API for the account's observations and keeps the results itself.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Card, framingFor, getCards, loadCatalog, photoFor, photoRemote } from './catalog';
import { addToCollection, loadCollection, owns } from './collection';
import { loadEcoMeta } from './ecoregions';
import { Naturalist, gradedOf } from './inatPublic';
import { ecoregionAt } from './locate';
import { snapshotStashed } from './offline';

export type Earned = { obsId: number; cardId: string; speciesId: number; name: string; eid: number; eco: string; date: string | null; at: number };
export type Waiting = { obsId: number; uri: string; name: string; date: string | null; card: boolean };
export type Potential = { key: string; name: string; sci: string; seen: number; why: string };
type State = {
  me: Naturalist | null;
  earned: Earned[];            // cards your sightings gave you, newest first
  waiting: Waiting[]; waitingTotal: number;
  potential: Potential[];
  already: number;             // confirmed sightings of cards you had journaled there anyway
  unplaced: number;            // confirmed sightings of cards with no ecoregion at that spot
  confirmed: number;           // confirmed observations in all
  checkedAt: number;
};
const EMPTY: State = { me: null, earned: [], waiting: [], waitingTotal: 0, potential: [], already: 0, unplaced: 0, confirmed: 0, checkedAt: 0 };
type Run = { busy: boolean; step: string | null; fresh: Earned[] | null; err: string | null };

const KEY = 'polygrove.sightings.v1';
const PAGE = 200, MAX_PAGES = 50;   // iNaturalist serves the first 10,000 of a search
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
    try { const raw = await AsyncStorage.getItem(KEY); if (raw) _s = { ...EMPTY, ...JSON.parse(raw) }; } catch { /* fresh start */ }
    emit();
  })();
  return _loaded;
}
export function useSightings(): State { return useSyncExternalStore(subscribe, () => _s, () => _s); }
export function useSightingsRun(): Run { return useSyncExternalStore(subscribe, () => _run, () => _run); }

// choosing or changing the account starts the lists over; cards already in
// your journals stay where they are
export function chooseMe(p: Naturalist) { _s = { ...EMPTY, me: p }; _run = { busy: _run.busy, step: null, fresh: null, err: null }; emit(); save(); }
export function forgetMe() { _s = EMPTY; _run = { busy: _run.busy, step: null, fresh: null, err: null }; emit(); save(); }

// WHAT A NON-CARD IS MISSING: the database's pool lists every species with at
// least four of a card's five facts and a mask of which it has (feeding 16 ·
// size 8 · food web 4 · habitat/origin 2 · biome 1). A big file, fetched once
// a session and only when there is something to explain.
type PoolRow = [string, string, number, ...unknown[]];
let _pool: Promise<Map<string, number>> | null = null;
function loadPool() {
  _pool ||= fetch('https://polygrovedb.pages.dev/data/pool.json')
    .then(r => { if (!r.ok) throw new Error(`pool ${r.status}`); return r.json(); })
    .then((rows: PoolRow[]) => new Map(rows.map(r => [String(r[0]).toLowerCase(), Number(r[2]) || 0])))
    .catch(e => { _pool = null; throw e; });
  return _pool;
}
const FACTS: [number, string][] = [[16, 'feeding role'], [8, 'size'], [4, 'food web'], [2, 'habitat or origin'], [1, 'biome']];
const missing = (mask: number) => FACTS.filter(([bit]) => !(mask & bit)).map(([, label]) => label);
const listOf = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

const pause = () => new Promise<void>(r => setTimeout(r, 0));

let _syncing: Promise<void> | null = null;
export function syncSightings(): Promise<void> {
  if (_syncing) return _syncing;
  const me = _s.me;
  if (!me) return Promise.resolve();
  _syncing = (async () => {
    run({ busy: true, step: 'Asking iNaturalist…', err: null });
    const fresh: Earned[] = [];
    // pairs (ecoregion:species) your sightings gave you on earlier checks
    const mine = new Set(_s.earned.map(e => `${e.eid}:${e.speciesId}`));
    try {
      const [, meta] = await Promise.all([loadCatalog(), loadEcoMeta(), loadCollection()]);
      const bySci = new Map<string, Card>(getCards().map(c => [c.sci.toLowerCase(), c]));
      const had = new Set<string>();   // journaled there some other way (a pack) before any sighting
      const pot = new Map<string, Potential>();
      const bump = (key: string, name: string, sci: string, why: string) => {
        const p = pot.get(key);
        if (p) p.seen += 1; else pot.set(key, { key, name, sci, seen: 1, why });
      };
      let unplaced = 0, confirmed = 0, done = 0;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const { list, total } = await gradedOf(me.id, 'research', page, PAGE);
        confirmed = total;
        for (const o of list) {
          done += 1;
          if (done % 40 === 0) { run({ step: `Placing sightings… ${done} of ${Math.min(total, PAGE * MAX_PAGES)}` }); await pause(); }
          if (_s.me?.id !== me.id) return;   // the account was changed mid-check
          if (!o.sci) continue;              // not identified to a species
          const card = bySci.get(o.sci.toLowerCase());
          if (!card) { bump(o.sci.toLowerCase(), o.name, o.sci, ''); continue; }
          const eid = o.lng != null && o.lat != null ? await ecoregionAt(o.lng, o.lat) : null;
          if (eid == null) { unplaced += 1; continue; }
          const eco = meta[String(eid)]?.name ?? 'that ecoregion';
          const inDeck = ((card.ecoregions as number[] | undefined) ?? []).includes(eid) && !!photoFor(card.id);
          if (!inDeck) { bump(`${card.species_id}@${eid}`, card.name, card.sci, `a card, but not in the deck for ${eco} yet`); continue; }
          const pair = `${eid}:${card.species_id}`;
          if (owns(eid, card.species_id)) { if (!mine.has(pair)) had.add(pair); continue; }   // a duplicate does nothing
          mine.add(pair);
          addToCollection(eid, card);
          // journaled cards are readable offline forever: photo, note and food web are fetched and kept
          snapshotStashed({ card, note: null, globi: [], photoUrl: photoRemote(card.id, 500), frame: framingFor(card.id) });
          fresh.push({ obsId: o.id, cardId: card.id, speciesId: card.species_id, name: card.name, eid, eco, date: o.date, at: Date.now() });
        }
        if (list.length < PAGE) break;
      }

      run({ step: 'Checking what is still waiting…' });
      const w = await gradedOf(me.id, 'needs_id', 1, PAGE);
      const waiting: Waiting[] = w.list.filter(o => o.sci).reverse()
        .map(o => ({ obsId: o.id, uri: o.uri, name: o.name, date: o.date, card: bySci.has((o.sci as string).toLowerCase()) }));

      // why each non-card isn't one yet
      const blank = [...pot.values()].filter(p => !p.why);
      if (blank.length) {
        try {
          const pool = await loadPool();
          for (const p of blank) {
            const mask = pool.get(p.sci.toLowerCase());
            const miss = mask == null ? null : missing(mask);
            p.why = miss == null ? 'not enough is known about it yet' : miss.length ? `needs its ${listOf(miss)}` : 'has its facts — still needs a photo or a check';
          }
        } catch { for (const p of blank) p.why = 'not a card yet'; }
      }

      if (_s.me?.id !== me.id) return;
      set({
        earned: [...[...fresh].reverse(), ..._s.earned],
        waiting, waitingTotal: w.total,
        potential: [...pot.values()].sort((a, b) => b.seen - a.seen || a.name.localeCompare(b.name)),
        already: had.size, unplaced, confirmed, checkedAt: Date.now(),
      });
      run({ fresh });
    } catch {
      // cards journaled before the connection dropped are kept and listed
      if (fresh.length && _s.me?.id === me.id) { set({ earned: [...[...fresh].reverse(), ..._s.earned] }); run({ fresh }); }
      run({ err: 'iNaturalist or the map data can’t be reached right now — try again in a bit.' });
    } finally {
      run({ busy: false, step: null });
      _syncing = null;
    }
  })();
  return _syncing;
}
