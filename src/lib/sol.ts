// Sol Points 🔆 — the currency for Solar Packs (the demo's rule: a Solar Pack
// costs 100 Sol; quizzes earn Sol). Everyone starts with 1000 (user,
// 2026-09-26) — ten packs to play with beyond the daily Discovery Pack.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'polygrove.sol.v1';
export const STARTING_SOL = 1000;
export const SOLAR_PACK_COST = 100;

let _sol = STARTING_SOL;
let _loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadSol() {
  _loaded ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw != null) _sol = Number(JSON.parse(raw).sol) || 0;
    } catch { /* fresh start */ }
    listeners.forEach(l => l());
  })();
  return _loaded;
}

export const sol = () => _sol;
export const canAffordSolar = () => _sol >= SOLAR_PACK_COST;

function set(n: number) {
  _sol = Math.max(0, Math.round(n));
  listeners.forEach(l => l());
  AsyncStorage.setItem(KEY, JSON.stringify({ sol: _sol })).catch(() => { /* best effort */ });
}
export const spendSol = (n: number) => set(_sol - n);
export const earnSol = (n: number) => set(_sol + n);

export function useSol(): number {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => _sol,
    () => _sol,
  );
}
