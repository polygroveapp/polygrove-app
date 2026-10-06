// HEXES OR LIST (user, 2026-10-06: "a button so you can switch between the
// hexes and the previous way"): each screen that has both remembers which
// the player last chose, on the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type ViewMode = 'hex' | 'list';
const KEY = (screen: string) => `polygrove.view.v1.${screen}`;
const _mode: Record<string, ViewMode> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// the store is loaded and written outside React: subscribing starts the load
const loading = new Set<string>();
function loadMode(screen: string) {
  if (screen in _mode || loading.has(screen)) return;
  loading.add(screen);
  AsyncStorage.getItem(KEY(screen)).then(v => { if (v === 'hex' || v === 'list') { _mode[screen] = v; emit(); } }).catch(() => {});
}
export function setViewMode(screen: string, m: ViewMode) {
  _mode[screen] = m; emit();
  AsyncStorage.setItem(KEY(screen), m).catch(() => {});
}
export function useViewMode(screen: string, fallback: ViewMode = 'hex'): [ViewMode, (m: ViewMode) => void] {
  const mode = useSyncExternalStore(l => { loadMode(screen); return subscribe(l); }, () => _mode[screen] ?? fallback, () => fallback);
  return [mode, m => setViewMode(screen, m)];
}
