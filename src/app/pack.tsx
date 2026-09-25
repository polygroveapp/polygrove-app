// Pack opening, faithful to the demo: cards arrive FACE-UP as a swipe deck.
// Drag rotates the card (offset * 0.12deg, demo SwipeCard); past 100px it flies
// off — RIGHT journals it, LEFT releases it. Tap flips to the details back.

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PolygroveCard from '../components/PolygroveCard';
import { C, F } from '../constants/polygrove';
import { Card, getCards, photoFor } from '../lib/catalog';
import { addToCollection, owns } from '../lib/collection';

const PACK_SIZE = 5;

function drawPack(): Card[] {
  const all = getCards();
  const pool = all.filter(c => !owns(c.species_id) && photoFor(c.id));
  const src = pool.length >= PACK_SIZE ? pool : all;
  const pack: Card[] = [];
  const seen = new Set<number>();
  while (pack.length < PACK_SIZE && seen.size < src.length) {
    const c = src[Math.floor(Math.random() * src.length)];
    if (seen.has(c.species_id)) continue;
    seen.add(c.species_id);
    pack.push(c);
  }
  return pack;
}

export default function PackOpening() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const catReady = getCards().length > 0;
  useEffect(() => { if (!catReady) router.replace('/'); }, [catReady, router]);
  const pack = useMemo(drawPack, []);
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState(0);

  if (!catReady) return null;

  if (idx >= pack.length) return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.center}>
        <Text style={s.doneTitle}>Pack complete</Text>
        <Text style={s.doneSub}>{kept} journaled · {pack.length - kept} released</Text>
        <Pressable onPress={() => router.replace('/collection')} style={s.primary}>
          <Text style={s.primaryTxt}>View Journal</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/pack')} style={s.ghost}>
          <Text style={s.ghostTxt}>Open another pack</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/')} style={s.ghost}>
          <Text style={s.ghostTxt}>Home</Text>
        </Pressable>
      </View>
    </View>
  );

  const onSwiped = (dir: 1 | -1) => {
    if (dir === 1) { addToCollection(pack[idx]); setKept(k => k + 1); }
    setIdx(i => i + 1);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 14 }]}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <Text style={s.back}>‹ Home</Text>
        </Pressable>
        <View style={s.dots}>
          {pack.map((_, i) => (
            <View key={i} style={[s.dot, i === idx && s.dotOn, i < idx && s.dotDone]} />
          ))}
        </View>
      </View>

      <View style={s.stage}>
        {/* next card waits behind at 0.95 scale, like the demo stack */}
        {pack[idx + 1] && (
          <View style={[s.cardSlot, { transform: [{ scale: 0.95 }] }]} pointerEvents="none">
            <PolygroveCard key={pack[idx + 1].id} card={pack[idx + 1]} />
          </View>
        )}
        <SwipeSlot key={pack[idx].id} onSwiped={onSwiped}>
          <PolygroveCard card={pack[idx]} />
        </SwipeSlot>
      </View>

      <View style={s.hintRow}>
        <Text style={s.hintL}>◂ release</Text>
        <Text style={s.hintC}>{idx + 1} of {pack.length} · tap card for details</Text>
        <Text style={s.hintR}>journal ▸</Text>
      </View>
    </View>
  );
}

function SwipeSlot({ children, onSwiped }: { children: React.ReactNode; onSwiped: (d: 1 | -1) => void }) {
  const tx = useSharedValue(0);
  const gone = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])   // let taps through to the card flip
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      if (Math.abs(tx.value) > 100) {
        const d = tx.value > 0 ? 1 : -1;
        gone.value = 1;
        tx.value = withTiming(d * 600, { duration: 300 });
        runOnJS(setTimeoutSwipe)(onSwiped, d);
      } else {
        tx.value = withSpring(0, { damping: 16, stiffness: 160 });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { rotate: `${tx.value * 0.12}deg` },   // the demo's drag tilt
    ],
    opacity: gone.value ? withTiming(0, { duration: 300 }) : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.cardSlot, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

function setTimeoutSwipe(onSwiped: (d: 1 | -1) => void, d: 1 | -1) {
  setTimeout(() => onSwiped(d), 300);
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#333' },
  dotOn: { width: 18, backgroundColor: C.greenSoft },
  dotDone: { backgroundColor: '#2E7D32' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardSlot: { position: 'absolute', width: '96%', maxWidth: 370, height: '96%', maxHeight: 560 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  hintL: { fontFamily: F.sansMed, fontSize: 11.5, color: '#666' },
  hintC: { fontFamily: F.sans, fontSize: 10.5, color: C.faint },
  hintR: { fontFamily: F.sansMed, fontSize: 11.5, color: C.greenSoft },
  doneTitle: { fontFamily: F.display, fontSize: 26, color: C.text },
  doneSub: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginBottom: 14 },
  primary: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 13, borderRadius: 24,
    backgroundColor: '#2E7D32', minWidth: 220, alignItems: 'center',
  },
  primaryTxt: { fontFamily: F.sansBold, fontSize: 14.5, color: C.text },
  ghost: { paddingVertical: 8 },
  ghostTxt: { fontFamily: F.sansMed, fontSize: 13.5, color: C.greenSoft },
});
