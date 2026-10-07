// A HONEYCOMB of cards (user, 2026-10-05: "a honeycomb based selector so it's
// just the photos with the borders on the select screen"). Hexagon photos
// packed in offset rows, a fixed number deep, growing to the right in a
// horizontal list that only mounts the columns on screen.
// THE CARD ABOVE THE COMB (user, 2026-10-06: "3 hexes tall, if you click on
// a hex it shows the card above the honeycomb. you can swipe to move right
// or left in the list"): a tap on a cell shows that card, full size, above
// the comb; a tap on the shown card opens it; swiping the card left or right
// steps to the next or previous cell, and the comb follows.

import { ReactNode, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { F } from '../constants/polygrove';
import { Frame } from '../lib/catalog';
import HexThumb from './HexThumb';

export type Comb = {
  key: string;
  uri?: string; frame?: Frame;
  border: string;
  name: string; sub?: string; meta?: string;
  fallback?: string;        // an emoji for a cell with no photo
  card?: () => ReactNode;   // the card to show above the comb (fills its box)
  onOpen: () => void;
};

const W = 66, H = 74, GAP = 6;   // one cell; rows overlap by a quarter so the comb packs
const PITCH = H * 0.75 + GAP / 2, STEP = W + GAP;

// THE SHOWN CARD: the picked cell's card, full size; swipe it sideways to
// step through its comb. A screen with several combs renders ONE of these
// above them all, controlling each comb's pick (user, 2026-10-06: "put this
// above cards from your sightings. only one can be displayed at once").
export function ShownCard({ cells, picked, onPick }: { cells: Comb[]; picked: string | null; onPick: (key: string | null) => void }) {
  const win = useWindowDimensions();
  const idx = cells.findIndex(c => c.key === picked);
  const cur = idx >= 0 ? cells[idx] : null;
  const tx = useSharedValue(0);
  const step = (d: number) => {
    const n = cells.findIndex(c => c.key === picked) + d;
    if (n >= 0 && n < cells.length) onPick(cells[n].key);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      const d = tx.value < -50 ? 1 : tx.value > 50 ? -1 : 0;
      if (d !== 0) runOnJS(step)(d);
      tx.value = withSpring(0, { damping: 18, stiffness: 170 });
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  // as tall as the gallery gives a card: shorter and the back's "Tap card to
  // flip" fell off the bottom (user, 2026-10-06)
  const cardSize = { width: Math.min(win.width - 48, 340), height: Math.min(530, Math.round(win.height * 0.61)) };
  if (!cur) return null;
  return (
    <View style={s.cardWrap}>
      {cur.card ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={[cardSize, dragStyle]}>
            {cur.card()}
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

// glowKey: the fresh Solar card (the journal's gold pulse) — picked at the start.
// picked/onPick: a screen that shows the card itself (ShownCard) controls the
// pick from outside; left out, the comb keeps its own pick and shows the card
// above itself.
export default function Honeycomb({ cells, label, glowKey, rows = 3, picked: pickedProp, onPick }:
  { cells: Comb[]; label?: string; glowKey?: string | null; rows?: number; picked?: string | null; onPick?: (key: string | null) => void }) {
  const [pickedOwn, setPickedOwn] = useState<string | null>(glowKey ?? null);
  const controlled = onPick !== undefined;
  // a card is ALWAYS on show (user, 2026-10-06: "always a card selected when
  // you open, the first one in the list"): your own pick while it is still in
  // the comb, else the fresh card's glow, else the first cell
  const inComb = (k: string | null | undefined) => !!k && cells.some(c => c.key === k);
  const picked = controlled ? pickedProp ?? null
    : inComb(pickedOwn) ? pickedOwn : inComb(glowKey) ? glowKey! : cells[0]?.key ?? null;
  const setPicked = (k: string | null) => (controlled ? onPick!(k) : setPickedOwn(k));
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (glowKey) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false);
  }, [glowKey, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#FFD700', shadowOpacity: 0.55 + 0.45 * pulse.value, shadowRadius: 8 + 10 * pulse.value, shadowOffset: { width: 0, height: 0 },
    transform: [{ scale: 1.06 + 0.03 * pulse.value }],
  }));
  const R = Math.max(1, Math.min(rows, cells.length));
  // columns of R cells; the LAST, partial column sits in the middle rows, so
  // its cells nest against the column before instead of dangling off the top
  // corner (user, 2026-10-06: "always forms a honeycomb pattern so the turkey
  // is a part of the honeycomb") — a cell in a middle row touches three
  // neighbours to the left, a cell in the top row only one
  const middleOut: number[] = [];
  for (let k = 0; k < R; k++) middleOut.push(Math.floor(R / 2) + (k % 2 ? -Math.ceil(k / 2) : Math.ceil(k / 2)));
  const cols: { c: Comb; r: number }[][] = [];
  for (let i = 0; i < cells.length; i += R) {
    const chunk = cells.slice(i, i + R);
    const rowsUsed = chunk.length === R ? middleOut.map((_, k) => k) : middleOut.slice(0, chunk.length).sort((a, b) => a - b);
    cols.push(chunk.map((c, k) => ({ c, r: rowsUsed[k] })));
  }
  const height = (R - 1) * PITCH + H;
  const idx = cells.findIndex(c => c.key === picked);
  const cur = idx >= 0 ? cells[idx] : null;
  const list = useRef<FlatList<{ c: Comb; r: number }[]>>(null);
  // the comb follows the pick: whenever the picked cell changes, its column scrolls into view
  useEffect(() => {
    if (idx < 0) return;
    const t = setTimeout(() => { try { list.current?.scrollToIndex({ index: Math.floor(idx / R), viewPosition: 0.5, animated: true }); } catch { /* not yet laid out */ } }, 60);
    return () => clearTimeout(t);
  }, [idx, R]);


  return (
    <View>
      {label ? <Text style={s.label}>{label}</Text> : null}
      {!controlled && cur ? <ShownCard cells={cells} picked={picked} onPick={setPicked} /> : null}
      {!cur && cells.length ? <Text style={s.hint}>{cols.length > 1 ? 'swipe sideways for more · ' : ''}tap a card to see it</Text> : null}
      <FlatList
        ref={list}
        horizontal
        data={cols}
        keyExtractor={(_, i) => `col${i}`}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: STEP, offset: STEP * i, index: i })}
        initialNumToRender={8}
        windowSize={5}
        extraData={picked}
        style={{ height, overflow: 'visible' }}
        contentContainerStyle={{ paddingRight: STEP / 2 }}   // room for the stepped-in rows' half-step
        removeClippedSubviews
        renderItem={({ item: col }) => (
          <View style={{ width: STEP, height, overflow: 'visible' }}>
            {col.map(({ c, r }) => {
              const on = c.key === picked, gold = c.key === glowKey;
              const ring = gold ? '#FFD700' : on ? '#ffffff' : c.border;
              const cell = (
                <Pressable onPress={() => (on ? c.onOpen() : setPicked(c.key))} hitSlop={2} style={[s.cell, on && !gold && s.cellOn]}>
                  <HexThumb uri={c.uri} width={W} height={H} borderColor={ring} borderWidth={on || gold ? 4 : 3} />
                  {!c.uri && c.fallback ? <Text style={s.fallback}>{c.fallback}</Text> : null}
                </Pressable>
              );
              return (
                <View key={c.key} style={{ position: 'absolute', top: r * PITCH, left: r % 2 ? 0 : STEP / 2, zIndex: on || gold ? 3 : 1 }}>
                  {gold ? <Animated.View style={glowStyle}>{cell}</Animated.View> : cell}
                </View>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: F.sansBold, fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  cardWrap: { alignItems: 'center', marginBottom: 12, gap: 6 },
  cell: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  cellOn: { transform: [{ scale: 1.08 }] },
  fallback: { position: 'absolute', fontSize: 22 },
  hint: { fontFamily: F.sans, fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 8 },
});
