// JOURNAL — the cards you've collected in the ecoregion you're in (one deck
// per ecoregion, 2026-09-26). Fully offline: snapshots + on-disk photos.

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { cardById, loadCatalog, photoFor } from '../lib/catalog';
import { loadCollection, useCollection } from '../lib/collection';
import { loadCurrentEco, useCurrentEco } from '../lib/ecoregions';
import { offlineReady } from '../lib/offline';

export default function Journal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const eco = useCurrentEco();
  const owned = useCollection(eco?.eid);
  // deep links land here cold — load all stores ourselves; offline snapshots
  // (offlineReady) keep the grid working when the catalog fetch fails
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.allSettled([loadCollection(), loadCurrentEco(), offlineReady(), loadCatalog()]).then(() => setReady(true));
  }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <View style={s.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Text style={s.back}>‹ Home</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Journal <Text style={s.count}>{owned.length}</Text></Text>
          <Text style={s.eco} numberOfLines={1}>{eco ? eco.name : 'no ecoregion chosen'}</Text>
        </View>
      </View>

      {owned.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>{eco ? 'Nothing collected here yet.' : 'Pick an ecoregion on the map first.'}</Text>
          <Pressable onPress={() => router.replace(eco ? '/pack' : '/map')} style={s.primary}>
            <Text style={s.primaryTxt}>{eco ? 'Open a pack' : 'Open the map'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={owned}
          keyExtractor={o => String(o.speciesId)}
          numColumns={3}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 16 }}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => {
            const card = cardById(item.id);
            const tc = card ? TROPHIC_COLOR[card.trophic] || C.dim : C.dim;
            const photo = photoFor(item.id, 320);
            return (
              <Pressable onPress={() => router.push(`/species/${item.id}`)} style={[s.cell, { borderColor: tc }]}>
                {photo
                  ? <Image source={{ uri: photo }} style={s.cellPhoto} resizeMode="cover" />
                  : <View style={[s.cellPhoto, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: C.faint }}>—</Text>
                    </View>}
                <Text style={s.cellName} numberOfLines={2}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  title: { fontFamily: F.display, fontSize: 20, color: C.text },
  count: { fontFamily: F.sans, fontSize: 13, color: C.dim },
  eco: { fontFamily: F.sansBold, fontSize: 10, color: '#8B5035', letterSpacing: 1.2, textTransform: 'uppercase' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTxt: { fontFamily: F.sans, fontSize: 14, color: C.dim },
  primary: { paddingHorizontal: 26, paddingVertical: 12, borderRadius: 22, backgroundColor: '#2E7D32' },
  primaryTxt: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  cell: {
    flex: 1 / 3, marginBottom: 10, borderRadius: 14, borderWidth: 1.5,
    backgroundColor: '#141414', overflow: 'hidden',
  },
  cellPhoto: { width: '100%', aspectRatio: 1, backgroundColor: '#181818' },
  cellName: { fontFamily: F.sansMed, fontSize: 11, color: C.text, padding: 7, minHeight: 38 },
});
