// POLYGROVEDB (the fourth tab; user, 2026-10-06: "a phone version of the
// database website … a page that says PolygroveDB with a search bar and all
// the filters, you select a species and it goes to a species page"). The
// whole catalog — every complete card, 14,713 species — searchable by name,
// filtered by group and feeding role, and by whether it lives in your camp's
// deck. A tap opens the species page (app/species/[id]).

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import HexThumb from '../components/HexThumb';
import { C, F, TROPHIC_COLOR, TROPHIC_ORDER } from '../constants/polygrove';
import { Card, getCards, loadCatalog, photoFor } from '../lib/catalog';
import { ecoMembers, loadCurrentEco, useCurrentEco } from '../lib/ecoregions';
import { useStars } from '../lib/stars';

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
  // STARRED ONLY (user, 2026-10-06: 'stars apply throughout the app') — the same stars the journal uses
  const [starsOnly, setStarsOnly] = useState(false);
  const stars = useStars();
  const [open, setOpen] = useState<'role' | 'group' | null>(null);   // the open dropdown, Field Notes style (user, 2026-10-06)
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
      if (starsOnly && !stars.has(c.id)) continue;
      if (needle && !c.name.toLowerCase().includes(needle) && !c.sci.toLowerCase().includes(needle)) continue;
      out.push(c);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, group, role, campOnly, starsOnly, stars, eco, needle]);
  const countIf = (patch: { group?: string | null; role?: string | null }) => {
    const g = patch.group !== undefined ? patch.group : group, r = patch.role !== undefined ? patch.role : role;
    const camp = campOnly && eco ? new Set(ecoMembers(eco.eid).map(c => c.id)) : null;
    let n = 0;
    for (const c of cards) {
      if (g && c.group !== g) continue;
      if (r && c.trophic !== r) continue;
      if (camp && !camp.has(c.id)) continue;
      if (starsOnly && !stars.has(c.id)) continue;
      if (needle && !c.name.toLowerCase().includes(needle) && !c.sci.toLowerCase().includes(needle)) continue;
      n++;
    }
    return n;
  };
  const filterKey = `${needle}|${group}|${role}|${campOnly}|${starsOnly}`;
  const shown = shownBy.key === filterKey ? shownBy.n : PAGE;

  const header = (
    <View style={{ paddingHorizontal: 20 }}>
      <Text style={s.title}>PolygroveDB</Text>
      <Text style={s.sub}>{ready ? `${cards.length.toLocaleString()} species · every complete card` : 'the open species database'}</Text>
      <TextInput value={q} onChangeText={setQ} placeholder="Search species…" placeholderTextColor="#666"
        autoCapitalize="none" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" style={s.search} />
      {/* the filters as Field Notes has them (user, 2026-10-06): dropdown
          boxes — label, count, value ▾ — the open one's options as chips
          below, and a box for "in your camp" */}
      <View style={s.filterRow}>
        <FilterBtn label="Role" value={role ?? undefined} color={role ? TROPHIC_COLOR[role] : undefined} count={rows.length}
          open={open === 'role'} onPress={() => setOpen(open === 'role' ? null : 'role')} />
        <FilterBtn label="Taxonomy" value={group ?? undefined} color={group ? C.greenSoft : undefined} count={rows.length}
          open={open === 'group'} onPress={() => setOpen(open === 'group' ? null : 'group')} />
        {/* the camp box in the tab bar's liquid glass (user, 2026-10-06): a frosted
            tile, and when on, the green-glass thumb with its top shine */}
        <Pressable onPress={() => eco && setCampOnly(v => !v)} accessibilityRole="button" accessibilityLabel="In your camp only" style={s.glassWrap}>
          <View style={[s.glass, campOnly && s.glassOn]}>
            {/* transparent glass (user, 2026-10-06): a light blur, a faint sheen, no fill — the green only when on */}
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={campOnly ? ['rgba(129,199,132,0.34)', 'rgba(76,175,80,0.12)', 'rgba(255,255,255,0.06)'] : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.05)']}
              locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={s.glassShine} />
            <View style={s.glassRim} />
            <Text style={[s.campBtnTxt, { opacity: campOnly ? 1 : 0.7 }]}>⛺</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setStarsOnly(v => !v)} accessibilityRole="button" accessibilityLabel="Starred species only"
          style={[s.filterBtn, s.campBtn, starsOnly && { borderColor: `${C.yellow}80`, backgroundColor: `${C.yellow}1f` }]}>
          <Text style={[s.campBtnTxt, { fontSize: 22, lineHeight: 26 }, starsOnly && { color: C.yellow }]}>{starsOnly ? '★' : '☆'}</Text>
        </Pressable>
      </View>
      {open ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {open === 'role' ? <>
            <Chip label="All" count={countIf({ role: null })} on={!role} onPress={() => setRole(null)} />
            {TROPHIC_ORDER.map(t => <Chip key={t} label={t} count={countIf({ role: t })} on={role === t} color={TROPHIC_COLOR[t]} onPress={() => setRole(role === t ? null : t)} />)}
          </> : <>
            <Chip label="All" count={countIf({ group: null })} on={!group} onPress={() => setGroup(null)} />
            {groups.map(g => <Chip key={g} label={g} count={countIf({ group: g })} on={group === g} color={C.greenSoft} onPress={() => setGroup(group === g ? null : g)} />)}
          </>}
        </ScrollView>
      ) : null}
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

function FilterBtn({ label, value, open, color, count, onPress }: { label: string; value?: string; open: boolean; color?: string; count: number; onPress: () => void }) {
  const tint = value && color ? { borderColor: `${color}80`, backgroundColor: `${color}1f` } : null;
  return (
    <Pressable onPress={onPress} style={[s.filterBtn, (open || value) && s.filterBtnOn, tint]}>
      <View style={s.filterTop}>
        <Text style={s.filterLabel}>{label}</Text>
        <Text style={s.filterCount}>{count.toLocaleString()}</Text>
      </View>
      <Text style={[s.filterValue, value && color ? { color } : null]} numberOfLines={1}>{value ?? 'All'} {open ? '▴' : '▾'}</Text>
    </Pressable>
  );
}
function Chip({ label, count, on, color, onPress }: { label: string; count: number; on: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn, on && color ? { borderColor: `${color}80`, backgroundColor: `${color}22` } : null]}>
      <Text style={[s.chipTxt, on && s.chipTxtOn, on && color ? { color } : null]}>{label}<Text style={s.chipCount}>  {count.toLocaleString()}</Text></Text>
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
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: { flex: 1, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)' },
  filterBtnOn: { borderColor: '#555555', backgroundColor: 'rgba(255,255,255,0.08)' },
  filterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterLabel: { fontFamily: F.sansBold, fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  filterCount: { fontFamily: F.sansMed, fontSize: 9.5, color: '#777' },
  filterValue: { fontFamily: F.sansMed, fontSize: 12.5, color: C.text, marginTop: 1 },
  campBtn: { flex: 0, width: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  campBtnTxt: { fontSize: 20, lineHeight: 24, color: '#777' },
  // the tab bar's thumb, as a box: frosted glass, a soft gradient, the top shine, a rim and a drop shadow
  glassWrap: { width: 52, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  glass: { flex: 1, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  glassOn: { backgroundColor: 'rgba(76,175,80,0.06)' },
  glassShine: { position: 'absolute', top: 0, left: 12, right: 12, height: 1.5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  glassRim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  chips: { gap: 7, paddingBottom: 12, paddingRight: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { borderColor: '#666666', backgroundColor: 'rgba(255,255,255,0.1)' },
  chipTxt: { fontFamily: F.sansMed, fontSize: 12, color: C.dim },
  chipTxtOn: { color: C.text },
  chipCount: { fontFamily: F.sans, fontSize: 10.5, color: '#777' },
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
