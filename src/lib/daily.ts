// The Discovery Pack resets every 24 hours (the demo's rule, home mock
// 2026-09-26). One free pack a day, whatever ecoregion you're in; Solar Packs
// (Sol points from quizzes) will be the way to open more.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'polygrove.daily.v1';
export const RESET_MS = 24 * 60 * 60 * 1000;
// ALWAYS OPEN (user, 2026-11-17: "make it so the daily discovery is a pack you can open
// up infinitely"; first asked 2026-10-02). One a day came back for a day on 2026-11-16
// ("it greys out saying come back tomorrow") — that code stays; flip this to false for it.
export const ALWAYS_OPEN = true;
let _lastAt = 0;
let _loaded: Promise<void> | null = null;

export function loadDaily() {
  _loaded ||= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) _lastAt = Number(JSON.parse(raw).lastAt) || 0;
    } catch { /* fresh start */ }
  })();
  return _loaded;
}

export const nextDiscoveryAt = () => _lastAt + RESET_MS;
export const discoveryReady = () => ALWAYS_OPEN || Date.now() >= nextDiscoveryAt();

export function markDiscoveryOpened() {
  _lastAt = Date.now();
  AsyncStorage.setItem(KEY, JSON.stringify({ lastAt: _lastAt })).catch(() => { /* best effort */ });
}

// the pack is ready again, as on a first launch
export function resetDiscovery() {
  _lastAt = 0;
  AsyncStorage.setItem(KEY, JSON.stringify({ lastAt: 0 })).catch(() => { /* best effort */ });
}

// "5h 12m" until the next pack; the clock is state so render stays pure,
// refreshed every 30s
export function useDiscoveryCountdown(): { ready: boolean; label: string } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ms = nextDiscoveryAt() - now;
  if (ALWAYS_OPEN) return { ready: true, label: 'Next pack: unlimited' };   // (user, 2026-11-17: "next pack: infinite … or unlimited"); it read "Open as many as you like" until 2026-11-16 (user: remove it)
  if (ms <= 0) return { ready: true, label: '' };   // ("Resets every 24 hours" until 2026-11-16: the button says Daily)
  const mins = Math.ceil(ms / 60_000);   // whole minutes first, so it never reads "23h 60m"
  const h = Math.floor(mins / 60), m = mins % 60;
  return { ready: false, label: `Next pack in ${h > 0 ? `${h}h ` : ''}${m}m` };
}
