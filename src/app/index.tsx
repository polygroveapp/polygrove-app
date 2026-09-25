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

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState('Connecting…');
  const [error, setError] = useState<string | null>(null);
  const owned = useCollection();

  useEffect(() => {
    Promise.all([loadCatalog(setStage), loadCollection()])
      .then(() => setReady(true))
      .catch(e => setError(String(e)));
  }, []);

  // the demo's breathing green pulse on the pack button
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={[s.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={{ alignItems: 'center' }}>
        <Text style={s.logo}>Polygrove</Text>
        <Text style={s.tag}>every living thing is a card</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
        {error ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={[s.tag, { color: '#E57373' }]}>Couldn’t reach the deck. {error}</Text>
            <Pressable onPress={() => { setError(null); loadCatalog(setStage).then(() => setReady(true)).catch(e => setError(String(e))); }}>
              <Text style={{ color: C.greenSoft, fontFamily: F.sansBold }}>Try again</Text>
            </Pressable>
          </View>
        ) : !ready ? (
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
    shadowColor: '#4CAF50', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
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
