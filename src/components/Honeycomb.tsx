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
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { F } from '../constants/polygrove';
import { Frame } from '../lib/catalog';
import HexThumb from './HexThumb';
import { useCardSize } from '../lib/cardSize';
import { useMouseDragScroll } from '../lib/dragScroll';
import { FlatCard } from './PolygroveCard';

export type Comb = {
  key: string;
  uri?: string; frame?: Frame;
  border: string;
  shimmer?: boolean;        // the map's glistening gold instead of a flat border (Solar level)
  date?: string | null;     // when it was seen (ISO), for the list's month/year filters
  name: string; sub?: string; meta?: string;
  fallback?: string;        // an emoji for a cell with no photo
  card?: () => ReactNode;   // the card to show above the comb (fills its box)
  cardId?: string | null;   // the deck card it stands for, if any (QuizButton)
  onOpen: () => void;
};

const W = 66, H = 74, GAP = 6;   // one cell; rows overlap by a quarter so the comb packs
const PITCH = H * 0.75 + GAP / 2, STEP = W + GAP;

// THE SHOWN CARD: the picked cell's card, full size; swipe it sideways to
// step through its comb. A screen with several combs renders ONE of these
// above them all, controlling each comb's pick (user, 2026-10-06: "put this
// above cards from your sightings. only one can be displayed at once").
// IT IS A PLAIN SIDEWAYS SCROLL (user, 2026-11-17: "make the friction to swipe left or
// right on the journal screens … just a scroll — no friction"). From 2026-10-06 the row
// was moved by a pan gesture and a spring, which on a phone's browser felt sticky: the
// finger had to travel 8 px before anything moved and the spring pulled against a fling.
// Now the system's own scroller carries the row, with its own momentum, and each card
// snaps to the middle when it comes to rest.
export function ShownCard({ cells, picked, onPick }: { cells: Comb[]; picked: string | null; onPick: (key: string | null) => void }) {
  const win = useWindowDimensions();
  const idx = cells.findIndex(c => c.key === picked);
  const cardSize = useCardSize(true);   // the one card size (lib/cardSize); these pages scroll, so it is never shrunk
  const GAP = 18;
  const step = cardSize.width + GAP;
  const side = Math.max(0, (win.width - cardSize.width) / 2);   // room either side, so the first and last card can sit in the middle
  const n = cells.length;
  const ref = useRef<ScrollView>(null);
  const at = useRef(-1);          // the card the scroller is resting on
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the comb picked a new cell (a tap), or the first showing: bring that card to the middle
  useEffect(() => {
    if (idx < 0 || idx === at.current) return;
    const first = at.current < 0;
    at.current = idx;
    ref.current?.scrollTo({ x: idx * step, animated: !first });
  }, [idx, step]);
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  // on a computer the row can be held with the mouse and pulled from card to card
  useMouseDragScroll(ref, { step, count: n, ready: idx >= 0 });
  if (idx < 0) return null;
  // the row has stopped moving (no scroll event for a moment): the card in the middle is the pick
  const onScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const i = Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (settle.current) clearTimeout(settle.current);
    const pick = () => { if (i !== at.current && cells[i]) { at.current = i; onPick(cells[i].key); } };
    // a long fling: follow it as it goes, so the cards it passes are drawn and not blank
    if (Math.abs(i - at.current) >= 2) pick(); else settle.current = setTimeout(pick, 90);
  };
  return (
    <View style={s.cardWrap}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false}
        onScroll={onScroll} scrollEventThrottle={16}
        contentOffset={{ x: Math.max(0, idx) * step, y: 0 }}
        snapToInterval={step} decelerationRate="fast" disableIntervalMomentum={false}
        style={[{ width: win.width, height: cardSize.height, flexGrow: 0 }, WEB_SNAP_ROW]}
        contentContainerStyle={{ paddingHorizontal: side }}>
        {cells.map((c, i) => (
          // only the card on show and three neighbours each side are drawn; the rest hold their place as blank cards
          <View key={c.key} style={[cardSize, i < n - 1 && { marginRight: GAP }, WEB_SNAP_CARD, Math.abs(i - idx) > 3 && s.cardGhost]}>
            {Math.abs(i - idx) <= 3 ? <FlatCard.Provider value>{c.card?.()}</FlatCard.Provider> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
// the browser's own snapping (React Native's snapToInterval does nothing on the web)
const WEB_SNAP_ROW = Platform.OS === 'web' ? ({ scrollSnapType: 'x mandatory' } as object) : null;
const WEB_SNAP_CARD = Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as object) : null;

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
  useMouseDragScroll(list, { ready: cells.length > 0 });   // the comb can be pulled along with a mouse too
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
                  <HexThumb uri={c.uri} width={W} height={H} borderColor={ring} borderWidth={on || gold ? 4 : 3} shimmer={!!c.shimmer && !on && !gold} />
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
  cardGhost: { backgroundColor: '#1a1a1a', borderRadius: 22, borderWidth: 1, borderColor: '#333333' },
  cardWrap: { alignItems: 'center', marginBottom: 12, gap: 6 },   // the scroller inside is as wide as the window and centred, so it overhangs a padded parent evenly
  cell: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  cellOn: { transform: [{ scale: 1.08 }] },
  fallback: { position: 'absolute', fontSize: 22 },
  hint: { fontFamily: F.sans, fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 8 },
});
