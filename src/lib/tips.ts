// The demo's one-time teaching moments (App.jsx swipeTipSeen /
// hasOpenedFirstPack), remembered across launches:
//   swipe      the "When Collecting Field Notes" card has been dismissed
//   firstPack  a first pack has been completed ("How Packs Work" was offered)
// `pendingPacksPopup` is the hand-off from the pack screen to Camp: the pack
// ends by going home, and home shows "How Packs Work" once.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'polygrove.tips.v1';
type Tips = { swipe?: boolean; firstPack?: boolean };
let _tips: Tips = {};
let _loaded: Promise<void> | null = null;
let _pendingPacksPopup = false;

export function loadTips() {
  _loaded ||= (async () => {
    try { const raw = await AsyncStorage.getItem(KEY); if (raw) _tips = JSON.parse(raw) || {}; } catch { /* fresh start */ }
  })();
  return _loaded;
}
export const tipSeen = (k: keyof Tips) => !!_tips[k];
export function markTip(k: keyof Tips) {
  if (_tips[k]) return;
  _tips = { ..._tips, [k]: true };
  AsyncStorage.setItem(KEY, JSON.stringify(_tips)).catch(() => { /* best effort */ });
}
export const queuePacksPopup = () => { _pendingPacksPopup = true; };
export const takePacksPopup = () => { const p = _pendingPacksPopup; _pendingPacksPopup = false; return p; };
