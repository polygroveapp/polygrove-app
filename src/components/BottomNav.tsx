// The fixed bottom tab bar: ⛺ Camp · 🧭 Map · 🌎 Social (home mock, 2026-09-26;
// plain tent instead of the demo's house per user; the middle tab is the MAP —
// Field Notes is reached from home's Journal button). Plain buttons over
// expo-router — the stack stays simple.
// LIQUID GLASS (user, 2026-09-28): the website's nav — a frosted pill track
// with a glassy green thumb that GLIDES under the active tab. Screens remount
// this bar on every tab change, so the thumb springs from the tab you came
// from (remembered module-wide) to the one you're on. The bar FLOATS over the
// screen (absolute, bottom) so content scrolls behind the glass — screens
// leave NAV_HEIGHT + insets.bottom under their content.

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../constants/polygrove';

const TABS = [
  { id: 'home', icon: '⛺', label: 'Camp', href: '/' },   // "Camp" (user, 2026-09-28)
  { id: 'map', icon: '🧭', label: 'Map', href: '/map' },
  // SOCIAL replaces About (user, 2026-09-29): iNaturalist, a globe. About is a link at its foot.
  { id: 'social', icon: '🌎', label: 'Social', href: '/social' },   // the Earth itself, not the wireframe globe (user)
] as const;

export type Tab = typeof TABS[number]['id'] | 'none';   // 'none' = no tab lit (Field Notes)

const PAD = 4;              // track padding around the thumb
const PILL_H = 60;
let lastIndex = 0;          // where the thumb was on the previous screen

export default function BottomNav({ active }: { active: Tab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trackW, setTrackW] = useState(0);
  const index = TABS.findIndex(t => t.id === active);
  const slot = trackW > 0 ? (trackW - PAD * 2) / TABS.length : 0;

  // the thumb: starts where it was on the last screen, springs to this tab
  const x = useSharedValue(lastIndex);
  useEffect(() => {
    if (index < 0) return;
    x.value = withSpring(index, { damping: 16, stiffness: 170, mass: 0.6 });
    lastIndex = index;
  }, [index, x]);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: PAD + x.value * slot }],
    width: slot,
  }));

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <BlurView intensity={28} tint="dark" blurMethod="dimezisBlurView" style={s.track}
        onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
        {index >= 0 && slot > 0 && (
          <Animated.View style={[s.thumb, thumb]}>
            <LinearGradient colors={['rgba(129,199,132,0.38)', 'rgba(76,175,80,0.16)', 'rgba(255,255,255,0.08)']}
              locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.thumbFill} />
            <View style={s.thumbShine} />
          </Animated.View>
        )}
        {TABS.map(t => (
          <Pressable key={t.id} style={s.tab}
            // tabs just SWITCH — no slide (user, 2026-09-29); `tab` tells the
            // stack to skip the animation, only the thumb glides
            onPress={() => { if (t.id !== active) router.replace({ pathname: t.href, params: { tab: '1' } }); }}>
            <Text style={s.icon}>{t.icon}</Text>
            <Text style={[s.label, t.id === active && s.labelOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </BlurView>
    </View>
  );
}

// space for screens to leave under their scroll content (the pill + its margin)
export const NAV_HEIGHT = PILL_H + 16;

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 8, backgroundColor: 'transparent' },
  track: {
    height: PILL_H, borderRadius: 999, padding: PAD, flexDirection: 'row', overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(20,24,20,0.72)' : 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
  },
  thumb: {
    position: 'absolute', top: PAD, bottom: PAD, left: 0, borderRadius: 999, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  thumbFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  thumbShine: { position: 'absolute', top: 0, left: 10, right: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },   // the inset top highlight
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  icon: { fontSize: 21, lineHeight: 25 },
  label: { fontFamily: F.sansBold, fontSize: 11, color: '#8f8f8f', marginTop: 1 },
  labelOn: { color: C.text },
});
