// A HONEYCOMB of cards (user, 2026-10-05: "a honeycomb based selector so it's
// just the photos with the borders on the select screen. then you tap on it
// and it shows the name and stuff. then you click on it to go to the next
// screen"). Hexagon photos packed in offset rows; one tap picks a cell and a
// strip under the comb names it; a second tap on that cell — or on the strip
// — opens it.

import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
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

export default function Honeycomb({ cells, label }: { cells: Comb[]; label?: string }) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const perRow = Math.max(1, Math.floor((width + GAP) / (W + GAP)));
  const rows: Comb[][] = [];
  // odd rows hold one fewer so the half-step offset stays inside the width
  for (let i = 0, r = 0; i < cells.length; r++) { const n = r % 2 ? perRow - 1 : perRow; rows.push(cells.slice(i, i + Math.max(1, n))); i += Math.max(1, n); }
  const cur = cells.find(c => c.key === picked) ?? null;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <View onLayout={onLayout}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={{ height: rows.length ? (rows.length - 1) * (H * 0.75 + GAP / 2) + H : 0 }}>
        {rows.map((row, r) => (
          <View key={r} style={[s.row, { top: r * (H * 0.75 + GAP / 2), left: r % 2 ? (W + GAP) / 2 : 0 }]}>
            {row.map(c => {
              const on = c.key === picked;
              return (
                <Pressable key={c.key} onPress={() => (on ? c.onOpen() : setPicked(c.key))} hitSlop={2}
                  style={[s.cell, on && s.cellOn]}>
                  {c.uri ? <HexPhoto uri={c.uri} frame={c.frame} width={W} height={H} borderColor={on ? '#ffffff' : c.border} borderWidth={on ? 4 : 3} />
                    : <HexPhoto width={W} height={H} borderColor={on ? '#ffffff' : c.border} borderWidth={on ? 4 : 3} />}
                  {!c.uri && c.fallback ? <Text style={s.fallback}>{c.fallback}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {cur ? (
        <Pressable onPress={cur.onOpen} style={[s.strip, { borderColor: `${cur.border}88` }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{cur.name}</Text>
            {cur.sub ? <Text style={s.sub} numberOfLines={1}>{cur.sub}</Text> : null}
            {cur.meta ? <Text style={s.meta} numberOfLines={2}>{cur.meta}</Text> : null}
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ) : cells.length ? <Text style={s.hint}>tap a card to see what it is · tap again to open it</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: F.sansBold, fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: { position: 'absolute', flexDirection: 'row', gap: GAP },
  cell: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  cellOn: { transform: [{ scale: 1.08 }], zIndex: 2 },
  fallback: { position: 'absolute', fontSize: 22 },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 10, borderRadius: 14,
    backgroundColor: '#141414', borderWidth: 1,
  },
  name: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  sub: { fontFamily: F.sans, fontSize: 11.5, color: '#888', fontStyle: 'italic', marginTop: 1 },
  meta: { fontFamily: F.sans, fontSize: 11, color: '#999', marginTop: 2, lineHeight: 15 },
  chev: { fontFamily: F.sansBold, fontSize: 18, color: '#555' },
  hint: { fontFamily: F.sans, fontSize: 11, color: '#666', textAlign: 'center', marginTop: 8 },
});
