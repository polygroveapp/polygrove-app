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
// grow: this segment's share of the track (default 1). Segments were all one width, so a long
// label — "Current Ecoregion" — wrapped onto two lines with its icon stranded at the far left
// (user, 2026-11-18: "the ecoregion emoji is too far to the left … make the text from left to
// right instead of stacked"). A wider share keeps it on one line; the thumb is as wide as
// whichever segment it sits on.
export type Segment<K extends string> = { key: K; label: string; n?: number; color?: string; icon?: ReactNode; grow?: number };

const PAD = 4;

export default function GlassSegments<K extends string>({ items, value, onChange }: { items: Segment<K>[]; value: K; onChange: (k: K) => void }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, items.findIndex(i => i.key === value));
  // where each segment starts and how wide it is, from its share of the track
  const inner = w > 0 ? w - PAD * 2 : 0;
  const total = items.reduce((t, it) => t + (it.grow ?? 1), 0);
  let left = PAD;
  for (let i = 0; i < idx; i++) left += inner * ((items[i].grow ?? 1) / total);
  const slot = inner * ((items[idx]?.grow ?? 1) / total);
  const x = useSharedValue(left), tw = useSharedValue(slot);
  const laidOut = useSharedValue(false);
  useEffect(() => {
    if (slot <= 0) return;
    const spring = { damping: 16, stiffness: 170, mass: 0.6 };
    // the first measurement places the thumb; after that it glides
    if (!laidOut.value) { x.value = left; tw.value = slot; laidOut.value = true; }
    else { x.value = withSpring(left, spring); tw.value = withSpring(slot, spring); }
  }, [left, slot, x, tw, laidOut]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: tw.value }));
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
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={[s.seg, it.grow != null && { flexGrow: it.grow }]} hitSlop={4}>
            <View style={s.labelRow}>
              {it.icon}
              <Text style={[s.label, on && s.labelOn]} numberOfLines={2}>{it.label}</Text>
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
  seg: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 999, gap: 0 },
  label: { fontFamily: F.sansBold, fontSize: 11, color: '#8f8f8f', lineHeight: 14, textAlign: 'center' },   // up to two lines: "📍 Around Camp Location" does not fit a third of a phone on one
  labelOn: { color: C.text },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontFamily: F.sans, fontSize: 12, color: '#8f8f8f', fontVariant: ['tabular-nums'], lineHeight: 14 },   // the regular weight — medium was still too heavy (user, 2026-10-06)
});
