// The Camp page's mini map, ALWAYS LOADED (user, 2026-09-29): a JPEG of each
// ecoregion's place on the globe, drawn once by the map page (map.html?mini=)
// and kept on the phone — memory first, AsyncStorage behind it — so the hero
// shows its map instantly and offline. One picture per ecoregion, ~50 KB.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

// v3 (2026-10-05): the map went back to black and grey (v1 pictures were in
// the earth colours), and v2 pictures caught the picker's white highlight —
// older pictures are left behind and redrawn on the next visit
const KEY = (eid: number) => `polygrove.minimap.v3.${eid}`;
const mem: Record<number, string | null> = {};   // null = looked, nothing stored
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function saveMiniMap(eid: number, dataUrl: string) {
  mem[eid] = dataUrl;
  emit();
  AsyncStorage.setItem(KEY(eid), dataUrl).catch(() => { /* memory copy still serves this session */ });
}

export function useMiniMap(eid: number): string | null {
  useEffect(() => {
    if (eid in mem) return;
    AsyncStorage.getItem(KEY(eid)).then(v => { if (!(eid in mem) || mem[eid] == null) { mem[eid] = v; emit(); } }).catch(() => { mem[eid] = null; });
  }, [eid]);
  return useSyncExternalStore(
    l => { listeners.add(l); return () => listeners.delete(l); },
    () => mem[eid] ?? null,
    () => null,
  );
}
