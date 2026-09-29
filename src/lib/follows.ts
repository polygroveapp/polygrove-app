// WHO YOU FOLLOW (Social, 2026-09-29). Kept on this phone only — iNaturalist
// is never told, and neither is anyone else: following here is a bookmark.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Naturalist } from './inatPublic';

const KEY = 'polygrove.follows.v1';
let _list: Naturalist[] = [];
let _loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(_list)).catch(() => { /* best effort */ });

export function loadFollows() {
  _loaded ||= (async () => {
    try { const raw = await AsyncStorage.getItem(KEY); if (raw) _list = JSON.parse(raw) || []; } catch { /* fresh start */ }
    emit();
  })();
  return _loaded;
}
export const isFollowing = (id: number) => _list.some(p => p.id === id);
export function follow(p: Naturalist) { if (!isFollowing(p.id)) { _list = [p, ..._list]; emit(); save(); } }
export function unfollow(id: number) { _list = _list.filter(p => p.id !== id); emit(); save(); }
// counts and avatars drift: refresh the stored copy when the account is looked at
export function refreshFollowed(p: Naturalist) {
  if (!isFollowing(p.id)) return;
  _list = _list.map(x => (x.id === p.id ? p : x)); emit(); save();
}
export function useFollows(): Naturalist[] {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => _list, () => _list);
}
