// WHERE THE PIN IS (2026-10-06): the map's pin position — a spot on the map
// the player chose, never the device's location — kept on the phone so the
// PolygroveDB tab can rank species by what is seen near it. Set by the map
// page's 'center' message, remembered across launches.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type Pin = { lng: number; lat: number; eid: number | null; name?: string };
const KEY = 'polygrove.pin.v1';
let _pin: Pin | null = null;
let _loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
function load() {
  if (_loaded) return;
  _loaded = true;
  AsyncStorage.getItem(KEY).then(v => { if (v && !_pin) { _pin = JSON.parse(v); emit(); } }).catch(() => {});
}
export function setPin(p: Pin) {
  _pin = p; emit();
  AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
}
export const getPin = () => (load(), _pin);
export function usePin(): Pin | null {
  return useSyncExternalStore(l => { load(); listeners.add(l); return () => { listeners.delete(l); }; }, () => _pin, () => null);
}
