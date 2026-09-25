// Full photo view (user, 2026-09-25): the hexagon crops the picture — this
// screen shows the whole thing. Black fullscreen, photo contained, name
// caption, ⓘ opens the Wikimedia Commons source/license page.

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, TROPHIC_COLOR } from '../../constants/polygrove';
import { cardById, getCards, loadCatalog, photoCommonsPage, photoFor } from '../../lib/catalog';

export default function FullPhoto() {
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
      <Pressable onPress={goBack}><Text style={s.closeTxt}>‹ Back</Text></Pressable>
    </View>
  );

  const tc = TROPHIC_COLOR[card.trophic] || '#81C784';
  const photo = photoFor(card.id, 1280);
  const commons = photoCommonsPage(card.id);

  return (
    <Pressable style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]} onPress={goBack}>
      {photo
        ? <Image source={{ uri: photo }} style={{ flex: 1 }} resizeMode="contain" />
        : <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: C.faint, fontFamily: F.sans }}>no photo</Text>
          </View>}
      <View style={s.caption} pointerEvents="box-none">
        <View>
          <Text style={[s.name, { color: tc }]}>{card.name}</Text>
          <Text style={s.sci}>{card.sci}</Text>
        </View>
        {!!commons && (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(commons)} style={s.srcBtn} hitSlop={8}>
            <Text style={s.srcTxt}>ⓘ source & license</Text>
          </Pressable>
        )}
      </View>
      <Text style={s.hint}>tap to close</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  caption: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 10,
  },
  name: { fontFamily: F.display, fontSize: 17 },
  sci: { fontFamily: F.sans, fontStyle: 'italic', fontSize: 12, color: C.dim, marginTop: 2 },
  srcBtn: { paddingVertical: 6 },
  srcTxt: { fontFamily: F.sansMed, fontSize: 12, color: '#8a8f8a' },
  hint: { textAlign: 'center', fontFamily: F.sans, fontSize: 10.5, color: '#555', marginTop: 6 },
  closeTxt: { color: C.greenSoft, fontFamily: F.sansBold, padding: 10 },
});
