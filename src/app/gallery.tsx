// CARD GALLERY — the demo's viewSwipeCard / RecentCardGallery (mock
// 2026-09-26): full-screen dark panel, ✕ top-right, "☀️ CARDS" + page dots
// (the current one wide, in the card's accent), and a horizontal carousel of
// the real cards with neighbors peeking at both sides. Drag to move between
// cards, tap a card to flip it. Wider gaps between cards than the demo (user).

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PolygroveCard from '../components/PolygroveCard';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, cardById, getCards, loadCatalog } from '../lib/catalog';
import { offlineReady } from '../lib/offline';

const GAP = 22;   // space between cards (demo: ~none)

export default function Gallery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const { ids, start } = useLocalSearchParams<{ ids?: string; start?: string }>();
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => {
    if (!ready) Promise.allSettled([offlineReady(), loadCatalog()]).then(() => setReady(true));
  }, [ready]);

  const cards: Card[] = ready
    ? String(ids ?? '').split(',').filter(Boolean).map(id => cardById(id)).filter((c): c is Card => !!c)
    : [];
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(Number(start) || 0, 9999)));
  const tx = useSharedValue(0);

  // narrower than the pack's card so the neighbors peek in at both edges
  // like the demo (card 0.8 of the screen, the rest is the two peeks)
  const cardSize = {
    width: Math.min(Math.round(win.width * 0.8), 340),
    height: Math.min(600, win.height - 150 - insets.top - insets.bottom),
  };
  const step = cardSize.width + GAP;
  const n = cards.length;

  const go = (i: number) => setIdx(Math.max(0, Math.min(n - 1, i)));
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])   // taps still flip the card
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      const d = tx.value < -50 ? 1 : tx.value > 50 ? -1 : 0;
      if (d !== 0) runOnJS(go)(idx + d);
      tx.value = withSpring(0, { damping: 18, stiffness: 170 });
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/deck'));
  const cur = cards[idx];
  const accent = cur ? TROPHIC_COLOR[cur.trophic] || C.greenSoft : C.greenSoft;

  return (
    // the whole backdrop closes: any tap outside the card (the dark area, the
    // gaps, a peeking neighbor) dismisses the gallery (user, 2026-09-26)
    <Pressable onPress={close} style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      {/* top-LEFT, as a labeled pill: the faint ✕ top-right hid under Expo's dev
          gear on the simulator and was easy to miss (user, 2026-09-26) */}
      <Pressable onPress={close} hitSlop={12} style={[s.x, { top: insets.top + 8 }]}>
        <Text style={s.xTxt}>✕  Close</Text>
      </Pressable>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <View style={s.head}>
          <Text style={s.label}>☀️ Cards</Text>
          <View style={s.dots}>
            {cards.map((c, i) => (
              <Pressable key={c.id} onPress={() => go(i)} hitSlop={4}
                style={[s.dot, i === idx && { width: 16, backgroundColor: TROPHIC_COLOR[c.trophic] || accent }]} />
            ))}
          </View>
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ height: cardSize.height, alignItems: 'center' }, dragStyle]}>
            {cards.map((c, i) => {
              const diff = i - idx;
              if (Math.abs(diff) > 2) return null;   // only neighbors are mounted
              return (
                <View key={c.id} pointerEvents={diff === 0 ? 'auto' : 'none'}
                  style={[cardSize, { position: 'absolute', top: 0, transform: [{ translateX: diff * step }] }]}>
                  <PolygroveCard card={c} />
                </View>
              );
            })}
          </Animated.View>
        </GestureDetector>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f0a' },
  x: {
    position: 'absolute', left: 16, zIndex: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  xTxt: { color: C.text, fontFamily: F.sansBold, fontSize: 13 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  label: { fontFamily: F.sansBold, fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
});
