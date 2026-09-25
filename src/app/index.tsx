import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, loadCatalog, photoFor } from '../lib/catalog';

export default function DeckBrowser() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [stage, setStage] = useState('Connecting…');
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog(setStage).then(r => setCards(r.cards)).catch(e => setError(String(e)));
  }, []);

  const groups = useMemo(
    () => (cards ? [...new Set(cards.map(c => c.group))].sort() : []),
    [cards],
  );
  const rows = useMemo(() => {
    if (!cards) return [];
    const ql = q.trim().toLowerCase();
    return cards.filter(c =>
      (!group || c.group === group) &&
      (!ql || c.name.toLowerCase().includes(ql) || c.sci.toLowerCase().includes(ql)));
  }, [cards, q, group]);

  if (error) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <Text style={s.loadTitle}>Polygrove</Text>
      <Text style={[s.stage, { color: '#E57373' }]}>Couldn’t reach the deck.</Text>
      <Text style={s.stage}>{error}</Text>
      <Pressable onPress={() => { setError(null); loadCatalog(setStage).then(r => setCards(r.cards)).catch(e => setError(String(e))); }}
        style={s.retry}><Text style={s.retryTxt}>Try again</Text></Pressable>
    </View>
  );

  if (!cards) return (
    <View style={[s.center, { paddingTop: insets.top }]}>
      <Text style={s.loadTitle}>Polygrove</Text>
      <ActivityIndicator color={C.green} style={{ marginVertical: 14 }} />
      <Text style={s.stage}>{stage}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
      <View style={s.header}>
        <Text style={s.logo}>Polygrove</Text>
        <Text style={s.count}>{rows.length.toLocaleString()} species</Text>
      </View>
      <TextInput
        value={q} onChangeText={setQ} placeholder="Search species…"
        placeholderTextColor={C.faint} style={s.search} autoCorrect={false}
      />
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        renderItem={({ item }) => <Row card={item} onPress={() => router.push(`/species/${item.id}`)} />}
      />
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

function Row({ card, onPress }: { card: Card; onPress: () => void }) {
  const tc = TROPHIC_COLOR[card.trophic] || C.dim;
  const photo = photoFor(card.id, 120);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: '#1a1f1a' }]}>
      <View style={[s.thumbRing, { borderColor: tc }]}>
        {photo
          ? <Image source={{ uri: photo }} style={s.thumb} />
          : <View style={[s.thumb, s.thumbEmpty]}><Text style={{ color: C.faint, fontSize: 10 }}>—</Text></View>}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.rowName} numberOfLines={1}>{card.name}</Text>
        <Text style={s.rowSci} numberOfLines={1}>{card.sci}</Text>
      </View>
      <Text style={[s.rowGroup, { color: tc }]}>{card.group}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadTitle: { fontFamily: F.display, fontSize: 30, color: C.text },
  stage: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginTop: 4, textAlign: 'center' },
  retry: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', backgroundColor: 'rgba(76,175,80,0.15)' },
  retryTxt: { fontFamily: F.sansBold, color: C.green, fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 16, paddingTop: 10 },
  logo: { fontFamily: F.display, fontSize: 24, color: C.text },
  count: { fontFamily: F.sans, fontSize: 12, color: C.dim, marginLeft: 10 },
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
