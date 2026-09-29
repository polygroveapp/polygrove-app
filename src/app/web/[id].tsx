// Expanded food web — the explorer's fwExpand overlay: black fullscreen, name +
// FOOD WEB header, the labeled fwGraphSVG ('lg': 500x500, nodeR 20, centerR 32,
// fontSize 14) with arrows; tap a node to open that species, tap outside to close.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWeb } from '../../lib/web';
import CloseX from '../../components/CloseX';
import FwGraph from '../../components/FwGraph';
import { C, F } from '../../constants/polygrove';
import { cardById, getCards, loadCatalog } from '../../lib/catalog';
import { globiRecords } from '../../lib/dossier';
import { offlineReady } from '../../lib/offline';

export default function FoodWebScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => {
    if (!ready) Promise.allSettled([offlineReady(), loadCatalog()]).then(() => setReady(true));
  }, [ready]);
  const [recs, setRecs] = useState<{ fact: string; value: string; derived: boolean }[] | null>(null);
  const [showRecs, setShowRecs] = useState(false);
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
      <CloseX onPress={goBack} />
      {/* ⓘ (user, 2026-09-26): every GloBI interaction record behind this web */}
      <Pressable hitSlop={10} style={[s.iBtn, { bottom: insets.bottom + 18 }]}
        onPress={async () => { setShowRecs(true); if (!recs) setRecs(await globiRecords(card.sci)); }}>
        <Text style={s.iTxt}>i</Text>
      </Pressable>
      {showRecs && (
        <Pressable style={s.recWrap} onPress={() => setShowRecs(false)}>
          <View style={s.recPanel} onStartShouldSetResponder={() => true}>
            <Text style={s.recTitle}>GloBI RECORDS</Text>
            <Text style={s.recSub}>{card.name} · every recorded interaction</Text>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 6 }}>
              {recs === null ? (
                <ActivityIndicator color={C.green} style={{ marginVertical: 20 }} />
              ) : recs.length === 0 ? (
                <Text style={s.recNone}>no interaction records</Text>
              ) : recs.map((r, i) => (
                <View key={i} style={s.recRow}>
                  <Text style={s.recFact}>{r.fact}{r.derived ? '  · derived' : ''}</Text>
                  <Text style={s.recVal}>{r.value}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => openWeb('https://www.globalbioticinteractions.org/')}>
              <Text style={s.recCredit}>source: GloBI — globalbioticinteractions.org ›</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
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
  hint: { position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#666666', fontFamily: F.sans },
  iBtn: {
    position: 'absolute', right: 22, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  iTxt: { color: '#999999', fontSize: 14, fontStyle: 'italic', fontFamily: F.sansBold },
  recWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  recPanel: {
    backgroundColor: '#181818', borderRadius: 16, borderWidth: 1, borderColor: '#333333',
    padding: 16, width: '100%', maxWidth: 380,
  },
  recTitle: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#888888', textAlign: 'center' },
  recSub: { fontFamily: F.sans, fontSize: 11.5, color: '#666666', textAlign: 'center', marginTop: 3, marginBottom: 10 },
  recRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingVertical: 8 },
  recFact: { fontFamily: F.sansBold, fontSize: 12.5, color: C.text },
  recVal: { fontFamily: F.sans, fontSize: 11.5, color: '#999999', marginTop: 2, lineHeight: 16 },
  recNone: { fontFamily: F.sans, fontSize: 12, color: '#666666', textAlign: 'center', marginVertical: 16 },
  recCredit: { fontFamily: F.sansMed, fontSize: 11, color: C.greenSoft, textAlign: 'center', marginTop: 10 },
});
