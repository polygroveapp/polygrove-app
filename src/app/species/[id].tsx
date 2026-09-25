import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, TROPHIC_COLOR } from '../../constants/polygrove';
import { FoodwebLink, cardById, cardByName, getCards, loadCatalog, photoFor } from '../../lib/catalog';

export default function SpeciesCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // deep links land here with a COLD cache — load the catalog ourselves
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => { if (!ready) loadCatalog().then(() => setReady(true)).catch(() => setReady(true)); }, [ready]);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const card = ready ? cardById(String(id)) : undefined;

  if (!ready) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <ActivityIndicator color={C.green} />
    </View>
  );
  if (!card) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <Text style={{ fontFamily: F.sans, color: C.dim }}>Card not found.</Text>
      <Pressable onPress={goBack}><Text style={s.back}>‹ Back</Text></Pressable>
    </View>
  );

  const tc = TROPHIC_COLOR[card.trophic] || C.dim;
  return <CardBody card={card} tc={tc} />;
}

function CardBody({ card, tc }: { card: NonNullable<ReturnType<typeof cardById>>; tc: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Wikimedia refuses upscaling past the original width — step down on error
  const sizes = [480, 320, 120];
  const [szIdx, setSzIdx] = useState(0);
  const photo = photoFor(card.id, sizes[Math.min(szIdx, sizes.length - 1)]);
  const slots: [string, string | null | undefined][] = [
    ['TROPHIC LEVEL', card.trophic],
    ['GROUP', card.group],
    ['SIZE', card.size],
    [String(card.slot5type || 'BIOME').toUpperCase(), card.slot5 || card.biome || card.habitat || card.origin],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 30 }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12} style={{ paddingHorizontal: 16 }}>
        <Text style={s.back}>‹ Deck</Text>
      </Pressable>

      <View style={[s.photoFrame, { borderColor: tc }]}>
        {photo
          ? <Image source={{ uri: photo }} style={s.photo} resizeMode="cover"
              onError={() => setSzIdx(i => Math.min(i + 1, sizes.length - 1))} />
          : <View style={[s.photo, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: C.faint, fontFamily: F.sans }}>no photo yet</Text>
            </View>}
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={s.name}>{card.name}</Text>
        <Text style={s.sci}>{card.sci}</Text>

        <View style={s.slotGrid}>
          {slots.map(([label, val]) => !!val && (
            <View key={label} style={s.slot}>
              <Text style={s.slotLabel}>{label}</Text>
              <Text style={[s.slotVal, label === 'TROPHIC LEVEL' && { color: tc }]}>{val}</Text>
            </View>
          ))}
        </View>

        {!!card.foodweb?.eatenBy?.length && (
          <WebList title="EATEN BY" links={card.foodweb.eatenBy} color="#E57373"
            onOpen={n => { const t = cardByName(n); if (t) router.push(`/species/${t.id}`); }} />
        )}
        {!!card.foodweb?.eats?.length && (
          <WebList title="EATS" links={card.foodweb.eats} color="#81C784"
            onOpen={n => { const t = cardByName(n); if (t) router.push(`/species/${t.id}`); }} />
        )}

        {!!card.lookAlikes?.length && (
          <View style={{ marginTop: 18 }}>
            <Text style={s.secTitle}>LOOK-ALIKES</Text>
            <View style={s.wrap}>
              {card.lookAlikes.map(n => {
                const t = cardByName(n);
                return (
                  <Pressable key={n} disabled={!t} onPress={() => t && router.push(`/species/${t.id}`)}
                    style={[s.pill, t && { borderColor: 'rgba(76,175,80,0.4)' }]}>
                    <Text style={[s.pillTxt, t && { color: C.greenSoft }]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function WebList({ title, links, color, onOpen }:
  { title: string; links: FoodwebLink[]; color: string; onOpen: (name: string) => void }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={s.secTitle}>{title}</Text>
      <View style={s.wrap}>
        {links.slice(0, 8).map(l => (
          <Pressable key={l.name} disabled={!l.card} onPress={() => onOpen(l.name)}
            style={[s.pill, l.card && { borderColor: `${color}66` }]}>
            <Text style={[s.pillTxt, l.card && { color }]}>{l.name}</Text>
            <Text style={s.evid}>×{l.evidence}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft, paddingVertical: 6 },
  photoFrame: {
    marginTop: 8, marginHorizontal: 20, borderRadius: 18, borderWidth: 2,
    overflow: 'hidden', backgroundColor: '#141414',
  },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#161616' },
  name: { fontFamily: F.display, fontSize: 26, color: C.text, marginTop: 16, lineHeight: 32 },
  sci: { fontFamily: F.sans, fontStyle: 'italic', fontSize: 14, color: C.dim, marginTop: 3 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  slot: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
  },
  slotLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.2, color: C.faint },
  slotVal: { fontFamily: F.sansMed, fontSize: 14, color: C.text, marginTop: 3 },
  secTitle: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: C.faint },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
    borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillTxt: { fontFamily: F.sansMed, fontSize: 12.5, color: C.dim },
  evid: { fontFamily: F.sans, fontSize: 9.5, color: C.faint },
});
