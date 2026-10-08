// HOW THE MAP LOOKS (user, 2026-10-07: "a button above the plus sign that
// changes the map to have color like the actual earth or go back to the grey
// and black"): one on-phone preference — earth colours or the grey/black
// picker — remembered across launches. Nothing about it leaves the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'polygrove.mapLook.v1';
let _earth = false;
let _loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
function load() {
  if (_loaded) return;
  _loaded = true;
  AsyncStorage.getItem(KEY).then(v => { if (v != null) { _earth = v === '1'; emit(); } }).catch(() => {});
}
export function setEarthColours(on: boolean) {
  _earth = on; emit();
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
}
export function useEarthColours(): boolean {
  return useSyncExternalStore(l => { load(); listeners.add(l); return () => { listeners.delete(l); }; }, () => _earth, () => false);
}
