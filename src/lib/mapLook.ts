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
let _obs = true;   // the ✕ sighting marks: on unless turned off
const KEY_O = 'polygrove.mapObs.v1';
// DOES THE PIN'S SPOT MATTER? (user, 2026-11-16: "make it so you can toggle whether the
// location of the pin matters or if it's just the ecoregion for probability".)
// ON BY DEFAULT, WITH THE MAP TILE TO SWITCH IT OFF (user, 2026-11-17: "the pin feature
// should always be on", then "put back the pin selection button for the map screen for
// flexibility"). On, packs favour the species recorded closest to where you camped,
// balanced by group so record counts cannot flood a pack with birds (pack.tsx drawNear).
// Off, every species of the ecoregion's deck is as likely as the next.
// v4 so this default reaches everyone (v3 and v1 defaulted to off, v2 to on).
let _pinDraw = true;
const KEY_P = 'polygrove.pinDraw.v4';
let _loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
function load() {
  if (_loaded) return;
  _loaded = true;
  AsyncStorage.getItem(KEY).then(v => { if (v != null) { _earth = v === '1'; emit(); } }).catch(() => {});
  AsyncStorage.getItem(KEY_P).then(v => { if (v != null) { _pinDraw = v === '1'; emit(); } }).catch(() => {});
  AsyncStorage.getItem(KEY_O).then(v => { if (v != null) { _obs = v === '1'; emit(); } }).catch(() => {});
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
export function setPinDraw(on: boolean) {
  _pinDraw = on; emit();
  AsyncStorage.setItem(KEY_P, on ? '1' : '0').catch(() => {});
}
export const getPinDraw = () => (load(), _pinDraw);
export function usePinDraw(): boolean {
  return useSyncExternalStore(l => { load(); listeners.add(l); return () => { listeners.delete(l); }; }, () => _pinDraw, () => true);
}
export function setShowObs(on: boolean) {
  _obs = on; emit();
  AsyncStorage.setItem(KEY_O, on ? '1' : '0').catch(() => {});
}
export function useShowObs(): boolean {
  return useSyncExternalStore(l => { load(); listeners.add(l); return () => { listeners.delete(l); }; }, () => _obs, () => true);
}
