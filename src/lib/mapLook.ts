// HOW THE MAP LOOKS (user, 2026-10-07: "a button above the plus sign that
// changes the map to have color like the actual earth or go back to the grey
// and black" · "another button for ecoregion borders"): two on-phone
// preferences — earth colours or the grey/black picker, and every ecoregion's
// outline on or off — remembered across launches. Nothing leaves the phone.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'polygrove.mapLook.v1';
const KEY_B = 'polygrove.mapBorders.v1';
let _earth = false;
let _borders = false;
let _loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
function load() {
  if (_loaded) return;
  _loaded = true;
  AsyncStorage.getItem(KEY).then(v => { if (v != null) { _earth = v === '1'; emit(); } }).catch(() => {});
  AsyncStorage.getItem(KEY_B).then(v => { if (v != null) { _borders = v === '1'; emit(); } }).catch(() => {});
}
export function setBorders(on: boolean) {
  _borders = on; emit();
  AsyncStorage.setItem(KEY_B, on ? '1' : '0').catch(() => {});
}
export function useBorders(): boolean {
  return useSyncExternalStore(l => { load(); listeners.add(l); return () => { listeners.delete(l); }; }, () => _borders, () => false);
}
export function setEarthColours(on: boolean) {
  _earth = on; emit();
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
}
export function useEarthColours(): boolean {
  return useSyncExternalStore(l => { load(); listeners.add(l); return () => { listeners.delete(l); }; }, () => _earth, () => false);
}
