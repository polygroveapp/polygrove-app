// POLYGROVEDB (the fourth tab; user, 2026-10-06: "a phone version of the
// database website … a page that says PolygroveDB with a search bar and all
// the filters, you select a species and it goes to a species page"). The
// whole catalog — every complete card, 14,713 species — searchable by name,
// filtered by group and feeding role, and by whether it lives in your camp's
// deck. A tap opens the species page (app/species/[id]).

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import HexThumb from '../components/HexThumb';
import { C, F, TROPHIC_COLOR, TROPHIC_ORDER } from '../constants/polygrove';
import { Card, getCards, loadCatalog, photoFor } from '../lib/catalog';
import { ecoMembers, loadCurrentEco, useCurrentEco } from '../lib/ecoregions';

const PAGE = 60;

export default function PolygroveDB() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const eco = useCurrentEco();
  const [ready, setReady] = useState(getCards().length > 0);
  const [error, setError] = useState(false);
  useEffect(() => { Promise.all([loadCatalog(), loadCurrentEco()]).then(() => setReady(true)).catch(() => setError(true)); }, []);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [campOnly, setCampOnly] = useState(false);
  // pagination resets with the filters: the count is remembered against the filter key
  const [shownBy, setShownBy] = useState<{ key: string; n: number }>({ key: '', n: PAGE });

  const cards = useMemo(() => (ready ? getCards() : []), [ready]);
  const groups = useMemo(() => [...new Set(cards.map(c => c.group))].sort(), [cards]);
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const camp = campOnly && eco ? new Set(ecoMembers(eco.eid).map(c => c.id)) : null;
    const out: Card[] = [];
    for (const c of cards) {
      if (group && c.group !== group) continue;
      if (role && c.trophic !== role) continue;
      if (camp && !camp.has(c.id)) continue;
      if (needle && !c.name.toLowerCase().includes(needle) && !c.sci.toLowerCase().includes(needle)) continue;
      out.push(c);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, group, role, campOnly, eco, needle]);
  const filterKey = `${needle}|${group}|${role}|${campOnly}`;
  const shown = shownBy.key === filterKey ? shownBy.n : PAGE;

  const header = (
    <View style={{ paddingHorizontal: 20 }}>
      <Text style={s.title}>PolygroveDB</Text>
      <Text style={s.sub}>{ready ? `${cards.length.toLocaleString()} species · every complete card` : 'the open species database'}</Text>
      <TextInput value={q} onChangeText={setQ} placeholder="Search species…" placeholderTextColor="#666"
        autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" style={s.search} />
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={['__all', ...TROPHIC_ORDER]} keyExtractor={x => x}
        contentContainerStyle={s.chips} renderItem={({ item: t }) => {
          const on = t === '__all' ? role === null : role === t, color = TROPHIC_COLOR[t];
          return <Chip label={t === '__all' ? 'All roles' : t} on={on} color={color} onPress={() => setRole(t === '__all' ? null : role === t ? null : t)} />;
        }} />
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={['__all', ...groups]} keyExtractor={x => x}
        contentContainerStyle={s.chips} renderItem={({ item: g }) => (
          <Chip label={g === '__all' ? 'All groups' : g} on={g === '__all' ? group === null : group === g} color={C.greenSoft}
            onPress={() => setGroup(g === '__all' ? null : group === g ? null : g)} />
        )} />
      <View style={[s.chips, { paddingHorizontal: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <Chip label={eco ? `In ${eco.name}` : 'In your camp'} on={campOnly} color={C.yellow} onPress={() => eco && setCampOnly(v => !v)} />
        <Text style={s.count}>{ready ? `${rows.length.toLocaleString()} species` : ''}</Text>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <GreenBackdrop />
      {error ? (
        <View style={[s.center, { paddingTop: insets.top + 80 }]}>
          <Text style={s.msg}>PolygroveDB needs an internet connection.</Text>
          <Pressable onPress={() => { setError(false); loadCatalog().then(() => setReady(true)).catch(() => setError(true)); }} style={s.retry}><Text style={s.retryTxt}>Try again</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={rows.slice(0, shown)}
          keyExtractor={c => c.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          onEndReachedThreshold={0.6}
          onEndReached={() => setShownBy(prev => ({ key: filterKey, n: Math.min(rows.length, (prev.key === filterKey ? prev.n : PAGE) + PAGE) }))}
          ListEmptyComponent={ready ? <Text style={s.msg}>No species match.</Text> : <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />}
          renderItem={({ item: c }) => {
            const tc = TROPHIC_COLOR[c.trophic] || C.greenSoft;
            return (
              <Pressable onPress={() => router.push({ pathname: '/species/[id]', params: { id: c.id } })} style={s.row}>
                <HexThumb uri={photoFor(c.id, 120)} width={46} height={52} borderColor={tc} borderWidth={2.5} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.sci} numberOfLines={1}>{c.sci}</Text>
                </View>
                <Text style={[s.grp, { color: tc }]}>{c.group.toUpperCase()}</Text>
                <Text style={s.chev}>›</Text>
              </Pressable>
            );
          }}
        />
      )}
      <BottomNav active="db" />
    </View>
  );
}

function Chip({ label, on, color, onPress }: { label: string; on: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && color ? { borderColor: `${color}80`, backgroundColor: `${color}22` } : null]}>
      <Text style={[s.chipTxt, on && color ? { color } : null]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  title: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34, textAlign: 'center' },
  sub: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginTop: 4, textAlign: 'center', marginBottom: 16 },
  search: {
    fontFamily: F.sans, fontSize: 14, color: C.text, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333', marginBottom: 10,
  },
  chips: { gap: 7, paddingBottom: 8, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipTxt: { fontFamily: F.sansMed, fontSize: 12, color: '#aaa' },
  count: { fontFamily: F.sans, fontSize: 11.5, color: '#777', marginLeft: 'auto' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a',
  },
  name: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  sci: { fontFamily: F.sans, fontSize: 11.5, color: '#888', marginTop: 1, fontStyle: 'italic' },
  grp: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1 },
  chev: { fontFamily: F.sansBold, fontSize: 18, color: '#555' },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, marginTop: 30 },
  retry: { marginTop: 14, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 22, backgroundColor: 'rgba(76,175,80,0.18)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.45)' },
  retryTxt: { fontFamily: F.display, fontSize: 12.5, color: C.green },
});
