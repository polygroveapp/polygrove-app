// The fixed bottom tab bar: ⛺ Camp · compass Map · 🌎 Social (home mock, 2026-09-26;
// plain tent instead of the demo's house per user; the middle tab is the MAP —
// Field Notes is reached from home's Journal button). Plain buttons over
// expo-router — the stack stays simple.
// LIQUID GLASS (user, 2026-09-28): the website's nav — a frosted pill track
// with a glassy green thumb that GLIDES under the active tab. Screens remount
// this bar on every tab change, so the thumb springs from the tab you came
// from (remembered module-wide) to the one you're on. The bar FLOATS over the
// screen (absolute, bottom) so content scrolls behind the glass — screens
// leave NAV_HEIGHT + insets.bottom under their content.

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { makeMutable, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../constants/polygrove';
import CompassIcon from './CompassIcon';
import GlassTrack from './GlassTrack';

const TABS = [
  { id: 'home', icon: '📍', label: 'Camp', href: '/' },   // "Camp" (user, 2026-09-28); a PIN, not the tent (user, 2026-11-17: "the camp emoji should be a pin")
  // a DRAWN compass in gold, muted (user, 2026-09-29; brown was tried) — CompassIcon
  { id: 'map', icon: 'compass', label: 'Map', href: '/map', dim: 0.85 },
  // SOCIAL replaces About (user, 2026-09-29): iNaturalist, a globe. About is a link at its foot.
  // the Earth itself, not the wireframe globe — and ONLY the globe is muted
  // (user, 2026-09-29; all three were for a moment): an emoji's colours can't
  // be changed, so it is drawn a little see-through
  // SIGHTINGS (user, 2026-10-05; "Social" before): your own iNaturalist
  // observations as cards. Social — following people, buying cards — is parked.
  // A CAMERA (user, same day; the globe before), dimmed like the compass
  // POLYGROVEDB (user, 2026-10-06): the database itself, searchable, every species' page — before Sightings (user, same day)
  { id: 'db', icon: '🌲', label: 'PolygroveDB', href: '/db', dim: 0.85 },   // a tree (user, 2026-10-06)
  { id: 'sightings', icon: '📷', label: 'Sightings', href: '/sightings', dim: 0.85 },
] as const;

export type Tab = typeof TABS[number]['id'] | 'none';   // 'none' = no tab lit (Field Notes)

const PAD = 4;              // track padding around the thumb
const PILL_H = 60;
// ONE thumb position for every copy of the bar (2026-09-29). Each screen has
// its own BottomNav, and the map's lives forever inside MapOverlay — with a
// position per copy the thumb jumped instead of gliding (the map's copy was
// already on "Map" when it came forward). Shared, whichever copy is on screen
// shows the same thumb, and the copy that comes forward slides it to its tab.
const thumbX = makeMutable(1);   // the app opens on the map

// shown = this copy's screen is the one in front (MapOverlay passes its `visible`)
export default function BottomNav({ active, shown = true }: { active: Tab; shown?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [trackW, setTrackW] = useState(0);
  const index = TABS.findIndex(t => t.id === active);
  const slot = trackW > 0 ? (trackW - PAD * 2) / TABS.length : 0;

  // the thumb glides from wherever it is to this tab when this copy comes forward
  useEffect(() => {
    if (index < 0 || !shown) return;
    thumbX.value = withSpring(index, { damping: 16, stiffness: 170, mass: 0.6 });
  }, [index, shown]);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: PAD + thumbX.value * slot }],
    width: slot,
  }));

  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      {/* the bar floats over the page, so its web fill is nearly solid: with no blur, text behind it must not show through */}
      <GlassTrack style={s.track} webFill="rgba(19,31,19,0.94)"
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
            {t.icon === 'compass'
              ? <View style={[s.iconBox, { opacity: t.dim }]}><CompassIcon size={24} /></View>
              : <Text style={[s.icon, 'dim' in t && { opacity: t.dim }]}>{t.icon}</Text>}
            <Text style={[s.label, t.id === active && s.labelOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </GlassTrack>
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
  iconBox: { height: 25, justifyContent: 'center' },   // the emoji's line height, so the labels line up
  label: { fontFamily: F.sansBold, fontSize: 11, color: '#8f8f8f', marginTop: 1 },
  labelOn: { color: C.text },
});
