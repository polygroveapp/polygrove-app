// LIGHT BEHIND THE DAILY CARD (user, 2026-11-18: "can you do an animation behind the card
// for the daily discovery"). The leaf burst was tried and taken out twice, so this is a
// different thing: it stays BEHIND the card and never covers it. Two fans of soft rays turn
// slowly in opposite directions — green for the Daily Discovery, a little pale gold in the
// second fan — and the card's edge breathes a green glow. Nothing takes a touch.
//   <CardAura centerY=… />  the rays, a full-screen layer placed under the card
//   <CardGlow />            the breathing edge, placed inside the card's own box
// With "reduce motion" on, the rays and the glow are shown still.
// THE SOLAR PACK HAS IT TOO (user, 2026-11-18: "can you do the same animation for the open
// pack background"): the same motion in the Solar Pack's gold (`tone="gold"`).

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Defs, Path, RadialGradient, Stop, Svg } from 'react-native-svg';

const D = 1300, R = D / 2;   // wide enough to reach the corners of a tall phone and most of a desktop window

// n wedges from the middle; `wide` and `thin` are the share of a slot each one fills, alternating
function fan(n: number, wide: number, thin: number): string {
  const step = (Math.PI * 2) / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const half = (step * (i % 2 ? thin : wide)) / 2, a = i * step;
    const x0 = R + R * Math.cos(a - half), y0 = R + R * Math.sin(a - half);
    const x1 = R + R * Math.cos(a + half), y1 = R + R * Math.sin(a + half);
    d += `M${R} ${R}L${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z`;
  }
  return d;
}

// each copy has its own gradient ids (see CompassIcon: a shared id resolves to the first copy in the page)
let _seq = 0;

export type AuraTone = 'green' | 'gold';
const TONES: Record<AuraTone, { a: string; b: string; glow: string }> = {
  green: { a: '#81C784', b: '#FFE082', glow: 'rgba(129,199,132,0.6)' },   // Daily Discovery
  gold: { a: '#FFC107', b: '#FFF3C4', glow: 'rgba(255,193,7,0.55)' },     // Solar Pack
};

function Rays({ d, color, peak, id }: { d: string; color: string; peak: number; id: string }) {
  return (
    <Svg width={D} height={D} viewBox={`0 0 ${D} ${D}`}>
      <Defs>
        {/* brightest just outside the card's edge, gone by the rim */}
        <RadialGradient id={id} gradientUnits="userSpaceOnUse" cx={R} cy={R} r={R}>
          <Stop offset="0" stopColor={color} stopOpacity={peak} />
          <Stop offset="0.42" stopColor={color} stopOpacity={peak * 0.7} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={d} fill={`url(#${id})`} />
    </Svg>
  );
}

export default function CardAura({ centerY, tone = 'green' }: { centerY: number; tone?: AuraTone }) {
  const still = useReducedMotion();
  const [u] = useState(() => `aura${++_seq}`);
  const turn = useSharedValue(0);   // 0..1, one slow lap
  const show = useSharedValue(0);
  const a = useMemo(() => fan(14, 0.5, 0.26), []);
  const b = useMemo(() => fan(9, 0.34, 0.2), []);
  useEffect(() => {
    show.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
    if (!still) turn.value = withRepeat(withTiming(1, { duration: 80000, easing: Easing.linear }), -1, false);
    return () => { cancelAnimation(turn); cancelAnimation(show); };
  }, [still, turn, show]);
  const fade = useAnimatedStyle(() => ({ opacity: show.value }));
  const spinA = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  const spinB = useAnimatedStyle(() => ({ transform: [{ rotate: `${-turn.value * 720 + 12}deg` }] }));
  return (
    <Animated.View style={[s.fill, fade]} pointerEvents="none">
      <View style={[s.hub, { top: centerY }]}>
        <Animated.View style={[s.disc, spinA]}><Rays d={a} color={TONES[tone].a} peak={0.34} id={`${u}a`} /></Animated.View>
        <Animated.View style={[s.disc, spinB]}><Rays d={b} color={TONES[tone].b} peak={0.2} id={`${u}b`} /></Animated.View>
      </View>
    </Animated.View>
  );
}

// the card's edge, breathing — sits inside the card's box, under the card
export function CardGlow({ radius = 22, tone = 'green' }: { radius?: number; tone?: AuraTone }) {
  const still = useReducedMotion();
  const beat = useSharedValue(0.55);
  useEffect(() => {
    if (!still) beat.value = withRepeat(withSequence(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
      withTiming(0.55, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
    ), -1, false);
    return () => cancelAnimation(beat);
  }, [still, beat]);
  const style = useAnimatedStyle(() => ({ opacity: beat.value }));
  return <Animated.View pointerEvents="none" style={[s.glow, { borderRadius: radius, boxShadow: `0px 0px 34px 12px ${TONES[tone].glow}` }, style]} />;
}

const s = StyleSheet.create({
  // clipped to the screen, so the wide discs never make a page scroll sideways
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  hub: { position: 'absolute', left: '50%', width: 0, height: 0 },
  disc: { position: 'absolute', left: -R, top: -R, width: D, height: D },
  glow: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6 },
});
