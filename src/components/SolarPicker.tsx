// SOLAR QUIZ PICKER (user, 2026-09-28): the home button pops up THREE random
// journaled cards in the SAME swipe stack as the final "Is this your card?"
// question — full cards, drag left/right, dots, opens on the middle one — with
// a gold "Choose this card" button, then "Randomize again" for three others
// or "Open journal" to pick from everything. Cards that are already fully
// Solar-locked are left out while any others remain.

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, getTier } from '../constants/polygrove';
import { Card, cardById } from '../lib/catalog';
import { Owned } from '../lib/collection';
import { countsOf, isFullyLocked, scoreOf } from '../lib/mastery';
import CloseX from './CloseX';
import PolygroveCard from './PolygroveCard';

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
  const tx = useSharedValue(0);
  const go = (i: number) => setIdx(Math.max(0, Math.min(n - 1, i)));
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      const d = tx.value < -50 ? 1 : tx.value > 50 ? -1 : 0;
      if (d !== 0) runOnJS(go)(idx + d);
      tx.value = withSpring(0, { damping: 18, stiffness: 170 });
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const quiz = () => { if (!cur) return; onClose(); router.push({ pathname: '/quiz/[id]', params: { id: cur.id } }); };
  const journal = () => { onClose(); router.push('/deck'); };
  const randomize = () => { setSeed(k => k + 1); setIdx(1); };
  const tier = cur ? getTier(scoreOf(cur.species_id)) : null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} onShow={() => setIdx(1)}>
      <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
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
          <Animated.View style={[{ height: cardSize.height, alignItems: 'center' }, dragStyle]}>
            {cards.map((c, i) => {
              const diff = i - idx;
              return (
                <View key={c.id} pointerEvents={diff === 0 ? 'auto' : 'none'}
                  style={[cardSize, { position: 'absolute', top: 0, transform: [{ translateX: diff * step }] }]}>
                  <PolygroveCard card={c} />
                </View>
              );
            })}
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f0a', paddingHorizontal: 20 },
  top: { alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  title: { fontFamily: F.display, fontSize: 17, color: C.text },
  sub: { fontFamily: F.sans, fontSize: 11, color: '#777', textAlign: 'center', marginTop: 8, marginBottom: 12 },
  dots: { flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  bottom: { marginTop: 'auto', gap: 8 },
  confirm: { padding: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFC107' },
  confirmTxt: { fontFamily: F.display, fontSize: 14, color: '#1a1a1a' },
  btns: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333',
  },
  btnTxt: { fontFamily: F.display, fontSize: 12, color: '#ccc' },
});
