// Per-card mastery — the demo's "skip-if-2-correct" mechanic (App.jsx
// questionCounts/scores), keyed by species_id. Each card has six questions
// (one per Geology tier); a question LOCKS after 2 correct answers. The tier
// = how many questions have been answered right at least once; Solar = all six.
// Sol: +1 when a non-Solar question locks, +5 the first time a card goes Solar.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { MASTERY, getLevel } from '../constants/polygrove';

export const NUM_Q = MASTERY.length;   // 6
export const LOCK_THRESHOLD = 2;
export type Counts = number[];

const KEY = 'polygrove.mastery.v1';
let _counts: Record<number, Counts> = {};
let _loaded: Promise<void> | null = null;
let _version = 0;
const listeners = new Set<() => void>();

export function loadMastery() {
  _loaded ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) _counts = JSON.parse(raw);
    } catch { /* fresh start */ }
    bump();
  })();
  return _loaded;
}
function bump() { _version++; listeners.forEach(l => l()); }
function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(_counts)).catch(() => { /* best effort */ });
}

export const emptyCounts = (): Counts => new Array(NUM_Q).fill(0);
export const countsOf = (sid: number): Counts => (_counts[sid] ? [..._counts[sid]] : emptyCounts());
export const countsToTier = (c: Counts) => c.reduce((n, x) => n + ((x || 0) >= 1 ? 1 : 0), 0);
export const scoreOf = (sid: number) => countsToTier(countsOf(sid));
export const isFullyLocked = (c: Counts) => c.every(x => (x || 0) >= LOCK_THRESHOLD);
// first question (from `from`) still below the lock; -1 when every one is locked
export function nextUnlocked(c: Counts, from = 0, available?: boolean[]) {
  for (let i = from; i < NUM_Q; i++) {
    if (available && !available[i]) continue;
    if ((c[i] || 0) < LOCK_THRESHOLD) return i;
  }
  return -1;
}

export type Advance = {
  counts: Counts; prevScore: number; newScore: number;
  justLocked: boolean; firstSolar: boolean; sol: number;
};
// a correct official answer on `level`: bump the count, recompute the tier,
// work out the Sol reward (the demo's rules, verbatim)
export function recordCorrect(sid: number, level: number): Advance {
  const c = countsOf(sid);
  const prevScore = countsToTier(c);
  const prevCount = c[level] || 0;
  c[level] = Math.min(prevCount + 1, LOCK_THRESHOLD);
  const newScore = countsToTier(c);
  const justLocked = prevCount < LOCK_THRESHOLD && c[level] === LOCK_THRESHOLD;
  const firstSolar = newScore > prevScore && newScore >= NUM_Q;
  const isSolarQuestion = level === NUM_Q - 1;
  const sol = (firstSolar ? 5 : 0) + (justLocked && !isSolarQuestion ? 1 : 0);
  _counts[sid] = c;
  persist(); bump();
  return { counts: c, prevScore, newScore, justLocked, firstSolar, sol };
}

// the demo's home stat: mean tier level across the journaled cards, as a %
export function masteryPct(sids: number[]) {
  if (!sids.length) return 0;
  const sum = sids.reduce((s, sid) => s + getLevel(scoreOf(sid)), 0);
  return Math.round((sum / sids.length) * 20);
}

// subscribe: returns a version number that changes on every update
export function useMastery(): number {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => _version,
    () => _version,
  );
}
