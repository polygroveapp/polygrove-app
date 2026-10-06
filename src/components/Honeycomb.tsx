// A HONEYCOMB of cards (user, 2026-10-05: "a honeycomb based selector so it's
// just the photos with the borders on the select screen. then you tap on it
// and it shows the name and stuff. then you click on it to go to the next
// screen"). Hexagon photos packed in offset rows; one tap picks a cell and a
// strip under the comb names it; a second tap on that cell — or on the strip
// — opens it.
// A FIXED HEIGHT, SWIPED SIDEWAYS (user, same day: "this height, but make it
// horizontal swipe to see the rest"): the comb is `rows` deep and grows to
// the right, column by column, in a horizontal list that only mounts the
// columns on screen — so hundreds of cards cost a screenful of photos.

import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { C, F } from '../constants/polygrove';
import { Frame } from '../lib/catalog';
import HexPhoto from './HexPhoto';

export type Comb = {
  key: string;
  uri?: string; frame?: Frame;
  border: string;
  name: string; sub?: string; meta?: string;
  fallback?: string;   // an emoji for a cell with no photo
  onOpen: () => void;
};

const W = 66, H = 74, GAP = 6;   // one cell; rows overlap by a quarter so the comb packs
const PITCH = H * 0.75 + GAP / 2, STEP = W + GAP;

// glowKey: the fresh Solar card (the journal's gold pulse) — picked at the start
export default function Honeycomb({ cells, label, glowKey, rows = 9 }: { cells: Comb[]; label?: string; glowKey?: string | null; rows?: number }) {
  const [picked, setPicked] = useState<string | null>(glowKey ?? null);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (glowKey) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false);
  }, [glowKey, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#FFD700', shadowOpacity: 0.55 + 0.45 * pulse.value, shadowRadius: 8 + 10 * pulse.value, shadowOffset: { width: 0, height: 0 },
    transform: [{ scale: 1.06 + 0.03 * pulse.value }],
  }));
  const R = Math.max(1, Math.min(rows, cells.length));
  const cols: Comb[][] = [];
  for (let i = 0; i < cells.length; i += R) cols.push(cells.slice(i, i + R));
  const height = (R - 1) * PITCH + H;
  const cur = cells.find(c => c.key === picked) ?? null;
  // open on the glowing card's column
  const list = useRef<FlatList<Comb[]>>(null);
  const glowCol = glowKey ? Math.floor(Math.max(0, cells.findIndex(c => c.key === glowKey)) / R) : 0;
  useEffect(() => {
    if (glowKey && glowCol > 0) setTimeout(() => { try { list.current?.scrollToIndex({ index: glowCol, viewPosition: 0.5, animated: true }); } catch { /* not yet laid out */ } }, 300);
  }, [glowKey, glowCol]);

  return (
    <View>
      {label ? <Text style={s.label}>{label}</Text> : null}
      {/* the name strip sits ABOVE the comb so it is always in view, however deep the comb */}
      {cur ? (
        <Pressable onPress={cur.onOpen} style={[s.strip, { borderColor: `${cur.border}88` }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{cur.name}</Text>
            {cur.sub ? <Text style={s.sub} numberOfLines={1}>{cur.sub}</Text> : null}
            {cur.meta ? <Text style={s.meta} numberOfLines={2}>{cur.meta}</Text> : null}
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ) : cells.length ? <Text style={s.hint}>{cols.length > 1 ? 'swipe sideways for more · ' : ''}tap a card to see what it is · tap again to open it</Text> : null}
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
        contentContainerStyle={{ paddingRight: STEP / 2 }}   // room for the odd rows' half-step
        renderItem={({ item: col }) => (
          <View style={{ width: STEP, height, overflow: 'visible' }}>
            {col.map((c, r) => {
              const on = c.key === picked, gold = c.key === glowKey;
              const ring = gold ? '#FFD700' : on ? '#ffffff' : c.border;
              const cell = (
                <Pressable onPress={() => (on ? c.onOpen() : setPicked(c.key))} hitSlop={2} style={[s.cell, on && !gold && s.cellOn]}>
                  {c.uri ? <HexPhoto uri={c.uri} frame={c.frame} width={W} height={H} borderColor={ring} borderWidth={on || gold ? 4 : 3} />
                    : <HexPhoto width={W} height={H} borderColor={ring} borderWidth={on || gold ? 4 : 3} />}
                  {!c.uri && c.fallback ? <Text style={s.fallback}>{c.fallback}</Text> : null}
                </Pressable>
              );
              return (
                <View key={c.key} style={{ position: 'absolute', top: r * PITCH, left: r % 2 ? STEP / 2 : 0, zIndex: on || gold ? 3 : 1 }}>
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
  cell: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  cellOn: { transform: [{ scale: 1.08 }] },
  fallback: { position: 'absolute', fontSize: 22 },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 10, borderRadius: 14,
    backgroundColor: '#141414', borderWidth: 1,
  },
  name: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  sub: { fontFamily: F.sans, fontSize: 11.5, color: '#888', fontStyle: 'italic', marginTop: 1 },
  meta: { fontFamily: F.sans, fontSize: 11, color: '#999', marginTop: 2, lineHeight: 15 },
  chev: { fontFamily: F.sansBold, fontSize: 18, color: '#555' },
  hint: { fontFamily: F.sans, fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 8 },
});
