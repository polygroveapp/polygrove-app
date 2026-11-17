// The demo's Solar celebration (App.jsx solarCelebration): near-black
// full-screen, 16 rotating sun rays, "SOLAR LEVEL", "+5 Sol", the card popping
// in with a gold pulse, tap anywhere to continue.

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { Defs, LinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { F } from '../constants/polygrove';
import { Card } from '../lib/catalog';
import PolygroveCard from './PolygroveCard';

export default function SolarCelebration({ card, sol = 5, onDone }: { card: Card; sol?: number; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const spin = useSharedValue(0);
  const pop = useSharedValue(0.7);
  const glow = useSharedValue(0);
  const txt = useSharedValue(0.8);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1, false);
    pop.value = withSpring(1, { damping: 12, stiffness: 140 });
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0, { duration: 1000 })), -1, false);
    txt.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0.8, { duration: 1000 })), -1, false);
  }, [spin, pop, glow, txt]);
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    shadowColor: '#FFD700', shadowOpacity: 0.7 + 0.3 * glow.value, shadowRadius: 30 + 25 * glow.value,
    shadowOffset: { width: 0, height: 0 },
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: txt.value }));

  // the card's type doesn't scale with width, so it needs its natural height
  // (~520) or the field note clips
  const cardW = Math.min(280, win.width - 80);
  const cardH = Math.min(540, win.height - insets.top - insets.bottom - 200);
  return (
    <Pressable onPress={onDone} style={[s.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
      <Animated.View style={[s.raysWrap, rays]} pointerEvents="none">
        <Svg width={600} height={600}>
          <Defs>
            <LinearGradient id="rayA" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F5A623" stopOpacity={0.6} /><Stop offset="1" stopColor="#F5A623" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="rayB" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F5A623" stopOpacity={0.3} /><Stop offset="1" stopColor="#F5A623" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {Array.from({ length: 16 }, (_, i) => (
            <Rect key={i} x={298.5} y={300} width={3} height={280} fill={`url(#${i % 2 ? 'rayB' : 'rayA'})`}
              transform={`rotate(${i * 22.5} 300 300)`} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.Text style={[s.title, titleStyle]}>SOLAR LEVEL</Animated.Text>
      <Text style={s.sol}>+{sol} Sol 🔆</Text>
      <Animated.View style={[{ width: cardW, height: cardH, borderRadius: 20 }, cardStyle]}>
        <PolygroveCard card={card} />
      </Animated.View>
      <Text style={s.hint}>Tap to continue</Text>
      <View style={{ flex: 1 }} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // explicit insets, never the absoluteFillObject spread (silently fails on Fabric)
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', zIndex: 200, paddingHorizontal: 24 },
  raysWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -300, marginTop: -300, width: 600, height: 600 },
  title: { fontFamily: F.display, fontSize: 13, color: '#F5A623', letterSpacing: 3, marginBottom: 6 },
  sol: { fontFamily: F.display, fontSize: 20, color: '#FFD700', marginBottom: 14, textShadowColor: 'rgba(255,215,0,0.6)', textShadowRadius: 12 },
  hint: { marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: F.sans },
});
