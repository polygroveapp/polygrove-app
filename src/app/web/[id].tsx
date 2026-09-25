// Expanded food web — the explorer's fwExpand overlay: black fullscreen, name +
// FOOD WEB header, the labeled fwGraphSVG ('lg': 500x500, nodeR 20, centerR 32,
// fontSize 14) with arrows; tap a node to open that species, tap outside to close.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FwGraph from '../../components/FwGraph';
import { C, F } from '../../constants/polygrove';
import { cardById, getCards, loadCatalog } from '../../lib/catalog';

export default function FoodWebScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => { if (!ready) loadCatalog().then(() => setReady(true)).catch(() => setReady(true)); }, [ready]);
  const card = ready ? cardById(String(id)) : undefined;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!ready) return <View style={s.root}><ActivityIndicator color={C.green} style={{ marginTop: 120 }} /></View>;
  if (!card) return (
    <View style={[s.root, s.center]}>
      <Text style={{ color: C.dim, fontFamily: F.sans }}>Card not found.</Text>
      <Pressable onPress={goBack}><Text style={{ color: C.greenSoft, fontFamily: F.sansBold, padding: 10 }}>‹ Back</Text></Pressable>
    </View>
  );

  const hasWeb = (card.foodweb?.eatenBy?.length || 0) + (card.foodweb?.eats?.length || 0) > 0;

  return (
    <Pressable style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} onPress={goBack}>
      <View style={s.head} pointerEvents="none">
        <Text style={s.title}>{card.name}</Text>
        <Text style={s.sub}>FOOD WEB</Text>
      </View>
      <View style={s.stage}>
        {hasWeb ? (
          <View style={s.square} onStartShouldSetResponder={() => true}>
            <FwGraph card={card} viewW={500} viewH={500} nodeR={20} centerR={32}
              fontSize={14} radiusFactor={0.34} showLabels
              onNodePress={cid => router.push(`/species/${cid}`)} />
          </View>
        ) : (
          <Text style={{ color: C.faint, fontFamily: F.sans }}>no recorded interactions</Text>
        )}
      </View>
      <Pressable onPress={goBack} style={[s.x, { top: insets.top + 12 }]} hitSlop={8}>
        <Text style={s.xTxt}>×</Text>
      </Pressable>
      <Text style={s.hint}>tap outside to close</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', top: 44, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  title: { fontFamily: F.display, fontSize: 22, color: C.text, textAlign: 'center', paddingHorizontal: 20, lineHeight: 26 },
  sub: { fontFamily: F.sansBold, fontSize: 12, color: '#666666', letterSpacing: 2, marginTop: 4 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 },
  square: { width: '100%', maxWidth: 520, aspectRatio: 1 },
  x: {
    position: 'absolute', right: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  xTxt: { color: C.text, fontSize: 18, lineHeight: 20 },
  hint: { position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#666666', fontFamily: F.sans },
});
