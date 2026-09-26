// SPECIES — the 🌲 tab: every species in the ecoregion you're in, journaled
// ones lit, the rest waiting (the demo's Species screen, 2026-09-26). Needs
// the catalog, so it's online-only by design — the journal is the offline view.

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, loadCatalog, photoFor } from '../lib/catalog';
import { loadCollection, owns, useCollection } from '../lib/collection';
import { ecoMembers, loadCurrentEco, localize, useCurrentEco } from '../lib/ecoregions';

export default function SpeciesTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const eco = useCurrentEco();
  const owned = useCollection(eco?.eid);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);

  const load = () =>
    Promise.all([loadCatalog(), loadCollection(), loadCurrentEco()])
      .then(() => setReady(true)).catch(e => setError(String(e)));
  useEffect(() => { load(); }, []);
  const retry = () => { setError(null); load(); };

  // the deck under its LOCAL names (English kept as nameEn for search)
  const cards = useMemo(
    () => (ready && eco
      ? ecoMembers(eco.eid).map(c => localize(c, eco)).sort((a, b) => a.name.localeCompare(b.name))
      : []),
    [ready, eco],
  );
  const groups = useMemo(() => [...new Set(cards.map(c => c.group))].sort(), [cards]);
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return cards.filter(c =>
      (!group || c.group === group) &&
      (!ql || c.name.toLowerCase().includes(ql) || c.sci.toLowerCase().includes(ql)
        || (c.nameEn?.toLowerCase().includes(ql) ?? false)));
  }, [cards, q, group]);

  let body: React.ReactNode;
  if (error) body = (
    <View style={s.center}>
      <Text style={[s.stage, { color: '#E57373' }]}>The species list needs an internet connection.</Text>
      <Pressable onPress={retry} style={s.retry}><Text style={s.retryTxt}>Try again</Text></Pressable>
    </View>
  );
  else if (!ready) body = <View style={s.center}><ActivityIndicator color={C.green} /></View>;
  else if (!eco) body = (
    <View style={s.center}>
      <Text style={s.stage}>Pick an ecoregion first.</Text>
      <Pressable onPress={() => router.push('/map')} style={s.retry}><Text style={s.retryTxt}>Open the map</Text></Pressable>
    </View>
  );
  else body = (
    <>
      <TextInput value={q} onChangeText={setQ} placeholder="Search species…"
        placeholderTextColor={C.faint} style={s.search} autoCorrect={false} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label="All" on={!group} onPress={() => setGroup(null)} />
          {groups.map(g => <Chip key={g} label={g} on={group === g} onPress={() => setGroup(group === g ? null : g)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={rows}
        keyExtractor={c => c.id}
        initialNumToRender={16}
        windowSize={7}
        extraData={owned}
        contentContainerStyle={{ paddingBottom: 12 }}
        renderItem={({ item }) => (
          <Row card={item} owned={owns(eco.eid, item.species_id)} onPress={() => router.push(`/species/${item.id}`)} />
        )}
      />
    </>
  );

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.logo}>Species</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.eco} numberOfLines={1}>{eco ? eco.name : '—'}</Text>
          {ready && eco && (
            <Text style={s.count}>{owned.length} of {cards.length.toLocaleString()} journaled</Text>
          )}
        </View>
      </View>
      {body}
      <BottomNav active="species" />
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

function Row({ card, owned, onPress }: { card: Card; owned: boolean; onPress: () => void }) {
  const tc = TROPHIC_COLOR[card.trophic] || C.dim;
  const photo = photoFor(card.id, 120);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: '#1a1f1a' }, !owned && { opacity: 0.45 }]}>
      <View style={[s.thumbRing, { borderColor: owned ? tc : '#333' }]}>
        {photo
          ? <Image source={{ uri: photo }} style={s.thumb} />
          : <View style={[s.thumb, s.thumbEmpty]}><Text style={{ color: C.faint, fontSize: 10 }}>—</Text></View>}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.rowName} numberOfLines={1}>{card.name}</Text>
        <Text style={s.rowSci} numberOfLines={1}>{card.nameEn ? `${card.nameEn} · ` : ''}{card.sci}</Text>
      </View>
      <Text style={[s.rowGroup, { color: owned ? tc : '#555' }]}>{owned ? card.group : '?'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stage: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginTop: 4, textAlign: 'center' },
  retry: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', backgroundColor: 'rgba(76,175,80,0.15)' },
  retryTxt: { fontFamily: F.sansBold, color: C.green, fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  logo: { fontFamily: F.display, fontSize: 22, color: C.text },
  eco: { fontFamily: F.sansBold, fontSize: 10.5, color: '#8B5035', letterSpacing: 1.2, textTransform: 'uppercase' },
  count: { fontFamily: F.sans, fontSize: 11.5, color: C.dim, marginTop: 1 },
  search: {
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(0,0,0,0.3)',
    color: C.text, fontFamily: F.sans, fontSize: 14,
  },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 7 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { borderColor: 'rgba(76,175,80,0.5)', backgroundColor: 'rgba(76,175,80,0.15)' },
  chipTxt: { fontFamily: F.sansMed, fontSize: 12, color: C.dim },
  chipTxtOn: { color: C.greenSoft },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9 },
  thumbRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1a1a1a' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: F.sansBold, fontSize: 14.5, color: C.text },
  rowSci: { fontFamily: F.sans, fontSize: 11.5, color: C.dim, fontStyle: 'italic', marginTop: 1 },
  rowGroup: { fontFamily: F.sansBold, fontSize: 10.5, marginLeft: 8 },
});
