// A SEGMENT SELECTOR IN THE TAB BAR'S STYLE (user, 2026-10-06: "one horizontal
// thing… a liquid glass selector for Sightings, Unconfirmed, Potential"; then
// "it still doesn't look good like this style does" — the bottom nav's): the
// same frosted track, the same green-glass thumb with its top shine, gliding
// to whichever segment you tap. Styling mirrors BottomNav.tsx.

import GlassTrack from './GlassTrack';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { C, F } from '../constants/polygrove';

// color: the count's colour when chosen; icon: drawn before the label (an emoji can just go in the label)
export type Segment<K extends string> = { key: K; label: string; n?: number; color?: string; icon?: ReactNode };

const PAD = 4;

export default function GlassSegments<K extends string>({ items, value, onChange }: { items: Segment<K>[]; value: K; onChange: (k: K) => void }) {
  const [w, setW] = useState(0);
  const slot = w > 0 ? (w - PAD * 2) / items.length : 0;
  const idx = Math.max(0, items.findIndex(i => i.key === value));
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(idx, { damping: 16, stiffness: 170, mass: 0.6 }); }, [idx, x]);
  // `slot` is listed by hand: with the React Compiler on, the worklet kept the
  // first render's 0 and the thumb drew as a sliver (2026-10-06)
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: PAD + x.value * slot }], width: slot }), [slot]);
  return (
    <GlassTrack style={s.track} webFill="rgba(255,255,255,0.06)" onLayout={e => setW(e.nativeEvent.layout.width)}>
      {slot > 0 ? (
        <Animated.View style={[s.thumb, thumb]}>
          <LinearGradient colors={['rgba(129,199,132,0.38)', 'rgba(76,175,80,0.16)', 'rgba(255,255,255,0.08)']}
            locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.thumbFill} />
          <View style={s.thumbShine} />
        </Animated.View>
      ) : null}
      {items.map(it => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={s.seg} hitSlop={4}>
            <View style={s.labelRow}>
              {it.icon}
              <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{it.label}</Text>
            </View>
            {it.n !== undefined ? <Text style={[s.count, on && it.color ? { color: it.color } : null]}>{it.n.toLocaleString()}</Text> : null}
          </Pressable>
        );
      })}
    </GlassTrack>
  );
}

const s = StyleSheet.create({
  track: {
    height: 50, borderRadius: 999, padding: PAD, flexDirection: 'row', overflow: 'hidden',   // tighter than the tab bar's 60 (user, 2026-10-07)
    backgroundColor: Platform.OS === 'android' ? 'rgba(20,24,20,0.72)' : 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  thumb: {
    position: 'absolute', top: PAD, bottom: PAD, left: 0, borderRadius: 999, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  thumbFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  thumbShine: { position: 'absolute', top: 0, left: 10, right: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, gap: 0 },
  label: { fontFamily: F.sansBold, fontSize: 11, color: '#8f8f8f', lineHeight: 14 },
  labelOn: { color: C.text },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontFamily: F.sans, fontSize: 12, color: '#8f8f8f', fontVariant: ['tabular-nums'], lineHeight: 14 },   // the regular weight — medium was still too heavy (user, 2026-10-06)
});
