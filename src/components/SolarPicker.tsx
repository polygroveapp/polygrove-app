// SOLAR QUIZ PICKER (user, 2026-09-28): the home button pops up THREE random
// journaled cards in the SAME swipe stack as the final "Is this your card?"
// question — full cards, drag left/right, dots, opens on the middle one — with
// a gold "Choose this card" button, then "Randomize again" for three others
// or "Open journal" to pick from everything. Cards that are already fully
// Solar-locked are left out while any others remain.

import { useRouter } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SharedValue, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, getTier } from '../constants/polygrove';
import { Card, cardById } from '../lib/catalog';
import { Owned } from '../lib/collection';
import { countsOf, isFullyLocked, scoreOf } from '../lib/mastery';
import CloseX from './CloseX';
import PolygroveCard from './PolygroveCard';
import GreenBackdrop, { GREEN_BG } from './GreenBackdrop';

const pickThree = (owned: Owned[]): Card[] => {
  const open = owned.filter(o => !isFullyLocked(countsOf(o.speciesId)));
  const pool = [...(open.length ? open : owned)];
  const out: Card[] = [];
  while (pool.length && out.length < 3) {
    const [o] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    const c = cardById(o.id);
    if (c) out.push(c);
  }
  return out;
};

export default function SolarPicker({ visible, owned, onClose }: { visible: boolean; owned: Owned[]; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  // a fresh three every time it opens; "Randomize again" bumps the seed
  const [seed, setSeed] = useState(0);
  const cards = useMemo(() => (visible ? pickThree(owned) : []), [visible, seed, owned]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(1);   // always open on the middle card
  const n = cards.length;
  const cur = cards[Math.min(idx, Math.max(0, n - 1))];

  const cardSize = { width: Math.min(Math.round(win.width * 0.78), 320), height: Math.min(520, Math.round(win.height * 0.56)) };
  const step = cardSize.width + 18;
  // ONE FLUID MOTION (user, 2026-10-06: "the swiping on this screen needs to
  // feel natural too"): a fractional position follows the finger, springs to
  // the nearest card and carries the fling; neighbours ride alongside
  const pos = useSharedValue(1);
  const start = useSharedValue(1);
  const SNAP = { damping: 22, stiffness: 190, mass: 0.7 };
  const go = (i: number) => { const t = Math.max(0, Math.min(n - 1, i)); pos.value = withSpring(t, SNAP); setIdx(t); };
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onStart(() => { start.value = pos.value; })
    .onChange(e => {
      const raw = start.value - e.translationX / step;
      pos.value = raw < 0 ? raw * 0.35 : raw > n - 1 ? n - 1 + (raw - (n - 1)) * 0.35 : raw;
    })
    .onEnd(e => {
      const target = Math.max(0, Math.min(n - 1, Math.round(pos.value - (e.velocityX / step) * 0.25)));
      pos.value = withSpring(target, { ...SNAP, velocity: -e.velocityX / step });
      runOnJS(setIdx)(target);
    });
  const reset = () => { pos.value = 1; setIdx(1); };

  const quiz = () => { if (!cur) return; onClose(); router.push({ pathname: '/quiz/[id]', params: { id: cur.id } }); };
  const journal = () => { onClose(); router.push('/deck'); };
  const randomize = () => { setSeed(k => k + 1); reset(); };
  const tier = cur ? getTier(scoreOf(cur.species_id)) : null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} onShow={reset}>
      <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <GreenBackdrop />
        <CloseX onPress={onClose} />
        <View style={s.top}>
          <Text style={s.title}>☀️ Choose a card</Text>
        </View>
        <Text style={s.sub}>Swipe between three of your cards · ace a question to earn Sol</Text>

        <View style={s.dots}>
          {cards.map((c, i) => (
            <Pressable key={c.id} onPress={() => go(i)} hitSlop={4} style={[s.dot, i === idx && { width: 16, backgroundColor: '#FFD700' }]} />
          ))}
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View style={{ height: cardSize.height, alignItems: 'center' }}>
            {cards.map((c, i) => <Slot key={c.id} i={i} pos={pos} step={step} active={i === idx} size={cardSize}><PolygroveCard card={c} /></Slot>)}
          </Animated.View>
        </GestureDetector>

        <View style={s.bottom}>
          <Pressable onPress={quiz} disabled={!cur} style={s.confirm}>
            <Text style={s.confirmTxt}>Choose this card{tier ? ` · ${tier.label}` : ''}</Text>
          </Pressable>
          <View style={s.btns}>
            <Pressable onPress={randomize} style={s.btn}><Text style={s.btnTxt}>🎲 Randomize again</Text></Pressable>
            <Pressable onPress={journal} style={s.btn}><Text style={s.btnTxt}>📖 Open journal</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// one card of the hand, placed by the hand's fractional position
function Slot({ i, pos, step, active, size, children }: { i: number; pos: SharedValue<number>; step: number; active: boolean; size: { width: number; height: number }; children: ReactNode }) {
  const at = useAnimatedStyle(() => ({ transform: [{ translateX: (i - pos.value) * step }] }));
  return <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[size, { position: 'absolute', top: 0 }, at]}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG, paddingHorizontal: 20 },
  top: { alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  title: { fontFamily: F.display, fontSize: 17, color: C.text },
  sub: { fontFamily: F.sans, fontSize: 11, color: '#777', textAlign: 'center', marginTop: 8, marginBottom: 12 },
  dots: { flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  bottom: { marginTop: 18, gap: 8 },
  confirm: { padding: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFC107' },
  confirmTxt: { fontFamily: F.display, fontSize: 14, color: '#1a1a1a' },
  btns: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333',
  },
  btnTxt: { fontFamily: F.display, fontSize: 12, color: '#ccc' },
});
