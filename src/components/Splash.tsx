// THE INTRO — the demo's splash, verbatim (App.jsx "Splash screen", ported
// 2026-09-29): the green hexagon with Half Dome at sunset fades up, then the
// Polygrove wordmark (0.8s), then the tagline (1.4s); the whole thing lifts
// away at 2.8s. Plays once per cold launch, over the app while it loads.

import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Image as SvgImage, Polygon, Svg } from 'react-native-svg';
import { C, F } from '../constants/polygrove';

const HALF_DOME = require('../../assets/images/half-dome.jpg');
const W = 160, H = 185, B = 6;   // the demo's hexagon: 160×185, 6px green border
const pts = (w: number, h: number, ox = 0, oy = 0) =>
  [[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]]
    .map(([x, y]) => `${ox + x * w},${oy + y * h}`).join(' ');

// the demo's fadeUp keyframes: 16px up + fade in, 0.7s ease
function FadeUp({ delay, children }: { delay: number; children: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: 16 * (1 - t.value) }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const out = useSharedValue(1);
  useEffect(() => {
    out.value = withDelay(2800, withTiming(0, { duration: 350 }, done => { if (done) runOnJS(onDone)(); }));
  }, [out, onDone]);
  const style = useAnimatedStyle(() => ({ opacity: out.value }));
  const iw = W - B * 2, ih = H - B * 2;
  // the photo is 400×525: fill the width and sit a quarter of the overflow
  // down, like the demo's object-position: center 25%
  const imgH = iw * (525 / 400);
  return (
    <Animated.View style={[s.root, style]}>
      <FadeUp delay={0}>
        <Svg width={W} height={H}>
          <Defs><ClipPath id="splashHex"><Polygon points={pts(iw, ih, B, B)} /></ClipPath></Defs>
          <Polygon points={pts(W, H)} fill={C.green} />
          <SvgImage href={HALF_DOME} x={B} y={B - (imgH - ih) * 0.25} width={iw} height={imgH}
            preserveAspectRatio="xMidYMid slice" clipPath="url(#splashHex)" />
        </Svg>
      </FadeUp>
      <FadeUp delay={800}><Text style={s.title}>Polygrove</Text></FadeUp>
      <FadeUp delay={1400}><Text style={s.sub}>An educational ecology trading card app</Text></FadeUp>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
    backgroundColor: '#0a0f0a', alignItems: 'center', justifyContent: 'center', gap: 28,
  },
  title: { fontFamily: F.display, fontSize: 36, color: C.green, letterSpacing: 1, lineHeight: 47 },
  sub: { fontFamily: F.sans, fontSize: 13, color: '#888', letterSpacing: 0.5, textAlign: 'center', paddingHorizontal: 40, lineHeight: 19.5 },
});
