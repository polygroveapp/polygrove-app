// A LIQUID-GLASS SEGMENT SELECTOR (user, 2026-10-06: "one horizontal thing,
// but a 3 liquid glass selector for Sightings, Unconfirmed, Potential instead
// of 3 fold down"): one bar, the chosen segment under a lens of frosted glass
// that slides to wherever you tap.

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { F } from '../constants/polygrove';

export type Segment<K extends string> = { key: K; label: string; n?: number; color?: string };   // color: the count's colour when chosen

const PAD = 4;

export default function GlassSegments<K extends string>({ items, value, onChange }: { items: Segment<K>[]; value: K; onChange: (k: K) => void }) {
  const [w, setW] = useState(0);
  const segW = w > 0 ? (w - PAD * 2) / items.length : 0;
  const idx = Math.max(0, items.findIndex(i => i.key === value));
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(idx * segW, { damping: 18, stiffness: 190, mass: 0.7 }); }, [idx, segW, x]);
  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={s.bar} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {segW > 0 ? (
        <Animated.View style={[s.lens, { width: segW }, lens]}>
          <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.16)']}
            locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={s.rim} />
        </Animated.View>
      ) : null}
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={s.seg} hitSlop={4}>
            <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{it.label}</Text>
            {it.n !== undefined ? <Text style={[s.count, on && s.countOn, on && it.color ? { color: it.color } : null]}>{it.n.toLocaleString()}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', padding: PAD, borderRadius: 999,   // the bottom nav's pill (user, 2026-10-06)
    backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 1, borderColor: 'rgba(129,199,132,0.22)',
  },
  lens: {
    position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: 999, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  rim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)' },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 1 },
  label: { fontFamily: F.sansBold, fontSize: 11.5, color: '#8a9a8a', letterSpacing: 0.3 },
  labelOn: { color: '#ffffff' },
  count: { fontFamily: F.display, fontSize: 13, color: '#6f806f' },
  countOn: { color: '#ffe14d' },
});
