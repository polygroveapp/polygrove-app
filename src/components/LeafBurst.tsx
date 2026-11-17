// A BURST OF LEAVES when a card goes into the journal (user, 2026-11-17: "make like an
// exploding leaf celebration whenever you get the card"). Leaves fly out from the middle
// of the screen in every direction, tumble, sink a little and fade — about a second.
// `fire` is a counter: each time it goes up, a new burst plays. It takes no touches.

import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const LEAVES = ['🍃', '🌿', '🍂', '🍁', '🍃', '🌱'];
const COUNT = 26;
export const LEAF_BURST_MS = 1100;

// a steady pseudo-random number in 0..1 for leaf i, trait k, burst n — the same on every
// render, so the leaves do not jump if the screen re-renders mid-flight
const rnd = (i: number, k: number, n: number) => { const x = Math.sin(i * 12.9898 + k * 78.233 + n * 37.719) * 43758.5453; return x - Math.floor(x); };

type Seed = { key: string; leaf: string; angle: number; dist: number; spin: number; size: number; late: number };

export default function LeafBurst({ fire }: { fire: number }) {
  const t = useSharedValue(1);   // 1 = at rest, nothing shown
  const seeds = useMemo<Seed[]>(() => Array.from({ length: COUNT }, (_, i) => ({
    key: `${fire}-${i}`,
    leaf: LEAVES[Math.floor(rnd(i, 1, fire) * LEAVES.length)],
    angle: (i / COUNT) * Math.PI * 2 + (rnd(i, 2, fire) - 0.5) * 0.5,
    dist: 130 + rnd(i, 3, fire) * 190,
    spin: (rnd(i, 4, fire) - 0.5) * 900,
    size: 20 + rnd(i, 5, fire) * 20,
    late: rnd(i, 6, fire) * 0.12,
  })), [fire]);
  useEffect(() => {
    if (fire <= 0) return;
    t.value = 0;
    t.value = withTiming(1, { duration: LEAF_BURST_MS, easing: Easing.linear });
  }, [fire, t]);
  if (fire <= 0) return null;
  return (
    <View style={s.fill} pointerEvents="none">
      <View style={s.origin}>
        {seeds.map(sd => <Leaf key={sd.key} sd={sd} t={t} />)}
      </View>
    </View>
  );
}

function Leaf({ sd, t }: { sd: Seed; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (t.value - sd.late) / (1 - sd.late)));
    const out = 1 - Math.pow(1 - p, 3);                 // fast out of the middle, slowing
    const fade = p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.45);
    return {
      opacity: p <= 0 || p >= 1 ? 0 : fade,
      transform: [
        { translateX: Math.cos(sd.angle) * sd.dist * out },
        { translateY: Math.sin(sd.angle) * sd.dist * out + 90 * p * p },   // and they sink
        { rotate: `${sd.spin * p}deg` },
        { scale: 0.4 + 0.9 * Math.min(1, p * 4) },
      ],
    };
  });
  return <Animated.Text style={[s.leaf, { fontSize: sd.size, lineHeight: sd.size * 1.25 }, style]}>{sd.leaf}</Animated.Text>;
}

const s = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  origin: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center', marginBottom: 60 },
  leaf: { position: 'absolute', textAlign: 'center', width: 60 },
});
