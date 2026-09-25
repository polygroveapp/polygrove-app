// Expanded food web screen — the explorer's fwExpand overlay as a route:
// black full-screen, focal hex, EATEN BY above / EATS below, evidence counts,
// tap a species to open its card.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HexPhoto from '../../components/HexPhoto';
import { C, F, TROPHIC_COLOR } from '../../constants/polygrove';
import { FoodwebLink, cardById, cardByName, getCards, loadCatalog, photoFor } from '../../lib/catalog';

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
    <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: C.dim, fontFamily: F.sans }}>Card not found.</Text>
      <Pressable onPress={goBack}><Text style={{ color: C.greenSoft, fontFamily: F.sansBold, padding: 10 }}>‹ Back</Text></Pressable>
    </View>
  );

  const tc = TROPHIC_COLOR[card.trophic] || '#81C784';
  const eatenBy = card.foodweb?.eatenBy || [];
  const eats = card.foodweb?.eats || [];

  return (
    <View style={[s.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
      <View style={s.head}>
        <Text style={s.title}>{card.name}</Text>
        <Text style={s.sub}>FOOD WEB</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        {eatenBy.length > 0 && (
          <>
            <Text style={[s.secLabel, { color: '#E57373' }]}>EATEN BY</Text>
            <View style={s.wrap}>{eatenBy.map(l => <Node key={l.name} link={l} />)}</View>
          </>
        )}
        <View style={s.focalRow}>
          <View style={s.vline} />
          <View style={{ alignItems: 'center' }}>
            <HexPhoto uri={photoFor(card.id, 250)} width={86} height={97} borderColor={tc} borderWidth={5} />
            <Text style={s.focalName}>{card.name}</Text>
            <Text style={[s.focalTrophic, { color: tc }]}>{card.trophic}</Text>
          </View>
          <View style={s.vline} />
        </View>
        {eats.length > 0 && (
          <>
            <Text style={[s.secLabel, { color: '#81C784' }]}>EATS</Text>
            <View style={s.wrap}>{eats.map(l => <Node key={l.name} link={l} />)}</View>
          </>
        )}
        {!eatenBy.length && !eats.length && (
          <Text style={{ color: C.faint, fontFamily: F.sans, textAlign: 'center', marginTop: 30 }}>
            no recorded interactions
          </Text>
        )}
        <Text style={s.credit}>GloBI, evidence-weighted · ×n = records</Text>
      </ScrollView>
      <Pressable onPress={goBack} style={s.closeBtn}>
        <Text style={s.closeTxt}>Close</Text>
      </Pressable>
    </View>
  );
}

function Node({ link }: { link: FoodwebLink }) {
  const router = useRouter();
  const other = cardByName(link.name);
  const oc = other ? (TROPHIC_COLOR[other.trophic] || '#666') : '#444';
  return (
    <Pressable disabled={!other} onPress={() => other && router.push(`/species/${other.id}`)} style={s.node}>
      <HexPhoto uri={other ? photoFor(other.id, 120) : undefined} width={52} height={58} borderColor={oc} borderWidth={3} />
      <Text style={s.nodeName} numberOfLines={2}>{link.name}</Text>
      <Text style={s.nodeEv}>×{link.evidence}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  head: { alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: F.display, fontSize: 22, color: C.text, textAlign: 'center', paddingHorizontal: 20 },
  sub: { fontFamily: F.sansBold, fontSize: 10, color: '#666', letterSpacing: 2.4, marginTop: 4 },
  secLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, textAlign: 'center', marginVertical: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  node: { alignItems: 'center', width: 84 },
  nodeName: { fontFamily: F.sansMed, fontSize: 10.5, color: C.text, textAlign: 'center', marginTop: 4 },
  nodeEv: { fontFamily: F.sans, fontSize: 9, color: C.faint, marginTop: 1 },
  focalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginVertical: 12 },
  vline: { flex: 1, height: 1, backgroundColor: '#222' },
  focalName: { fontFamily: F.display, fontSize: 13, color: C.text, marginTop: 6, textAlign: 'center' },
  focalTrophic: { fontFamily: F.sansBold, fontSize: 10, marginTop: 2 },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#444', textAlign: 'center', marginTop: 22 },
  closeBtn: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 11, borderRadius: 22,
    backgroundColor: '#222', marginTop: 6,
  },
  closeTxt: { fontFamily: F.sansBold, fontSize: 13.5, color: '#999' },
});
