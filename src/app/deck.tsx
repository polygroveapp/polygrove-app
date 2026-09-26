// SPECIES — the demo's "Field Notes" screen (App.jsx screen === "web", mock
// 2026-09-26): the ecoregion's whole deck as a 3-column grid of 3:4 cards.
// Journaled cards show their photo, name and mastery tier; the rest sit dark
// with a ❓ and "???" until you find them. Needs the catalog → online-only;
// the Journal is the offline view.

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import { C, F, MASTERY, getLevel, getTier } from '../constants/polygrove';
import { Card, loadCatalog, photoFor } from '../lib/catalog';
import { loadCollection, owns, useCollection } from '../lib/collection';
import { ecoMembers, loadCurrentEco, useCurrentEco } from '../lib/ecoregions';

export default function FieldNotes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const eco = useCurrentEco();
  const owned = useCollection(eco?.eid);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    Promise.all([loadCatalog(), loadCollection(), loadCurrentEco()])
      .then(() => setReady(true)).catch(e => setError(String(e)));
  useEffect(() => { load(); }, []);
  const retry = () => { setError(null); load(); };

  const cards = useMemo(
    () => (ready && eco ? [...ecoMembers(eco.eid)].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [ready, eco],
  );

  const header = (
    <>
      <View style={s.header}>
        <Text style={s.logo}>Polygrove</Text>
        <Pressable onPress={() => router.push('/map')} hitSlop={8}>
          <Text style={s.ecoLabel} numberOfLines={1}>{eco ? eco.name : 'Choose your ecoregion'}</Text>
        </Pressable>
        <Text style={s.tagline}>An educational ecology trading card game</Text>
      </View>
      <View style={s.titleWrap}>
        <Text style={s.title}>Field Notes</Text>
        <Text style={s.sub}>{owned.length}/{cards.length} Journaled</Text>
      </View>
    </>
  );

  let body: React.ReactNode;
  if (error) body = (
    <View style={s.center}>
      <Text style={[s.msg, { color: '#E57373' }]}>Field Notes need an internet connection.</Text>
      <Pressable onPress={retry} style={s.retry}><Text style={s.retryTxt}>Try again</Text></Pressable>
    </View>
  );
  else if (!ready) body = <View style={s.center}><ActivityIndicator color={C.green} /></View>;
  else if (!eco) body = (
    <View style={s.center}>
      <Text style={s.msg}>Pick an ecoregion first.</Text>
      <Pressable onPress={() => router.push('/map')} style={s.retry}><Text style={s.retryTxt}>Open the map</Text></Pressable>
    </View>
  );
  else body = (
    <FlatList
      data={cards}
      keyExtractor={c => c.id}
      numColumns={3}
      initialNumToRender={18}
      windowSize={7}
      extraData={owned}
      ListHeaderComponent={header}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
      renderItem={({ item }) => (
        <Cell card={item} journaled={owns(eco.eid, item.species_id)}
          onPress={() => router.push(`/species/${item.id}`)} />
      )}
    />
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {ready && eco && !error ? body : <>{header}{body}</>}
      <BottomNav active="species" />
    </View>
  );
}

// one grid card — the demo's tile, verbatim: 3:4, 2px tier border, photo
// with a name gradient, "CLAY LEVEL" + six mastery dots; 35% opacity + ❓
// until journaled. Mastery score is 0 for everyone until the quiz lands.
function Cell({ card, journaled, onPress }: { card: Card; journaled: boolean; onPress: () => void }) {
  const score = 0;
  const t = getTier(score);
  const photo = journaled ? photoFor(card.id, 330) : undefined;
  return (
    <Pressable onPress={onPress} disabled={!journaled}
      style={[s.cell, journaled
        ? { borderColor: t.border, backgroundColor: '#1a1a1a', shadowColor: t.border }
        : { borderColor: '#222222', backgroundColor: '#111111', opacity: 0.35 }]}>
      <View style={[s.photoWrap, !journaled && { backgroundColor: '#0d0d0d' }]}>
        {journaled ? (
          <>
            {!!photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} style={s.nameGrad}>
              <Text style={s.name} numberOfLines={2}>{card.name}</Text>
            </LinearGradient>
          </>
        ) : (
          <Text style={s.unknown}>?</Text>
        )}
      </View>
      <View style={s.foot}>
        <Text style={[s.tier, { color: journaled ? t.border : '#333333' }]} numberOfLines={1}>
          {journaled ? `${t.label} LEVEL` : '???'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {MASTERY.map((m, i) => (
            <View key={m.key} style={[s.dot, { backgroundColor: journaled && i <= getLevel(score) ? m.border : '#222222' }]} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d140d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { fontFamily: F.sans, fontSize: 13, color: C.dim, textAlign: 'center' },
  retry: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', backgroundColor: 'rgba(76,175,80,0.15)' },
  retryTxt: { fontFamily: F.sansBold, color: C.green, fontSize: 13 },
  // the demo's header, same as home
  header: {
    marginHorizontal: -20, padding: 20, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.15)',
  },
  logo: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34, marginBottom: 4 },
  ecoLabel: { fontFamily: F.sansBold, fontSize: 11, color: '#8B5035', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2, maxWidth: 320 },
  tagline: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5 },
  titleWrap: { alignItems: 'center', paddingTop: 16, marginBottom: 16 },
  title: { fontFamily: F.display, fontSize: 20, color: C.text, marginBottom: 2 },
  sub: { fontFamily: F.sans, fontSize: 12, color: '#555' },
  // grid card
  cell: {
    flex: 1 / 3, aspectRatio: 3 / 4, marginBottom: 10, borderRadius: 12, borderWidth: 2, overflow: 'hidden',
    shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  photoWrap: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  nameGrad: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 6, paddingBottom: 4 },
  name: { fontFamily: F.sansBold, fontSize: 9, color: C.text, lineHeight: 11 },
  unknown: { fontFamily: F.display, fontSize: 28, color: '#1f1f1f' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 3 },
  tier: { fontFamily: F.sansBold, fontSize: 7, textTransform: 'uppercase', flexShrink: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
