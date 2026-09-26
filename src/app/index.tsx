import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../constants/polygrove';
import { loadCatalog } from '../lib/catalog';
import { loadCollection, useCollection } from '../lib/collection';
import { offlineReady, packsReady, topUp } from '../lib/offline';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState('Opening the journal…');
  const [offline, setOffline] = useState(false);
  const owned = useCollection();

  // the hub gates on LOCAL stores only — offline launch still reaches the
  // queue and journal. The catalog loads behind it and tops up the queue.
  const fetchCatalog = () =>
    loadCatalog(setStage).then(() => topUp()).catch(() => setOffline(true));
  useEffect(() => {
    Promise.all([loadCollection(), offlineReady()]).then(() => setReady(true));
    fetchCatalog();
  }, []);

  // the demo's greenPulse, verbatim (App.jsx keyframes): the GLOW itself
  // blooms — shadow 16px@0.25 → 28px@0.85 with a wide halo — over 1.8s,
  // with a 1.02 scale breath
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.02 * pulse.value }],
    shadowColor: '#4CAF50',
    shadowOpacity: 0.25 + 0.6 * pulse.value,
    shadowRadius: 16 + 24 * pulse.value,
    shadowOffset: { width: 0, height: 4 * (1 - pulse.value) },
    elevation: 8 + 8 * pulse.value,
  }));

  return (
    <View style={[s.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ alignItems: 'center' }}>
        <Text style={s.logo}>Polygrove</Text>
        <Text style={s.tag}>every living thing is a card</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
        {!ready ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={C.green} />
            <Text style={s.tag}>{stage}</Text>
          </View>
        ) : (
          <>
            <Animated.View style={pulseStyle}>
              <Pressable onPress={() => router.push('/pack')} style={s.packBtn}>
                <Text style={s.packEmoji}>🎴</Text>
                <Text style={s.packTxt}>Open Discovery Pack</Text>
              </Pressable>
            </Animated.View>
            {offline && (
              <Pressable onPress={() => { setOffline(false); fetchCatalog(); }} style={{ alignSelf: 'center' }}>
                <Text style={s.tag}>
                  offline · {packsReady()} pack{packsReady() === 1 ? '' : 's'} in reserve · tap to retry
                </Text>
              </Pressable>
            )}

            <Pressable onPress={() => router.push('/collection')} style={s.secondary}>
              <Text style={s.secondaryTxt}>Journal</Text>
              <Text style={s.secondaryCount}>{owned.length} collected</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/deck')} style={s.secondary}>
              <Text style={s.secondaryTxt}>Browse the deck</Text>
              <Text style={s.secondaryCount}>10,394 species</Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={s.foot}>content: polygrovedb.pages.dev · GBIF, Wikipedia & 25 open sources</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 26 },
  logo: { fontFamily: F.display, fontSize: 38, color: C.text },
  tag: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginTop: 6, textAlign: 'center' },
  packBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18, borderRadius: 16, backgroundColor: '#2E7D32',
    // the glow lives on the animated wrapper (greenPulse) — none here
  },
  packEmoji: { fontSize: 18 },
  packTxt: { fontFamily: F.display, fontSize: 16, color: C.text },
  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16,
    borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryTxt: { fontFamily: F.sansBold, fontSize: 15, color: C.text },
  secondaryCount: { fontFamily: F.sans, fontSize: 12, color: C.dim },
  foot: { fontFamily: F.sans, fontSize: 10, color: C.faint, textAlign: 'center' },
});
