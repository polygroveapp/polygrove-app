// POLYGROVEDB (the fourth tab; user, 2026-10-06: "a phone version of the
// database website … a page that says PolygroveDB with a search bar and all
// the filters, you select a species and it goes to a species page"). The
// whole catalog — every complete card, 14,713 species — searchable by name,
// filtered by group and feeding role, and by whether it lives in your camp's
// deck. A tap opens the species page (app/species/[id]).

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import EcoregionIcon from '../components/EcoregionIcon';
import GlassSegments from '../components/GlassSegments';
import HexThumb from '../components/HexThumb';
import { C, F, TROPHIC_COLOR, TROPHIC_ORDER } from '../constants/polygrove';
import { Card, getCards, loadCatalog, photoForDb } from '../lib/catalog';
import { campSpot, loadCurrentEco, useCurrentEco } from '../lib/ecoregions';
import { ecoRanking, pinRanking } from '../lib/nearby';
import { usePin } from '../lib/pin';
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
  // ALL · PIN · TENT (user, 2026-10-06: "the pin matters"): all species; the
  // ones most likely to be seen near the pin, most-recorded first; the ones
  // most likely in your camp's ecoregion, likewise — a sliding glass pill
  const [where, setWhere] = useState<'all' | 'pin' | 'tent'>('pin');   // opens on Camp (user, 2026-11-16; was All)
  const pin = usePin();
  const [rankFor, setRankFor] = useState<{ key: string; rank: Map<string, number> } | null>(null);
  // "Camp" ranks by the spot where you camped (user, 2026-11-16: the pin is where you camp), not wherever the map's pin has wandered since
  const spot = campSpot(eco, pin);
  const rankKey = where === 'pin' && spot ? `pin:${spot.lng.toFixed(1)},${spot.lat.toFixed(1)}` : where === 'tent' && eco ? `tent:${eco.eid}` : '';
  useEffect(() => {
    if (!rankKey) return;
    let on = true;
    const p = rankKey.startsWith('pin:') && spot ? pinRanking(spot.lng, spot.lat) : eco ? ecoRanking(eco.eid) : Promise.resolve([] as [string, number][]);
    p.then(list => { if (on) setRankFor({ key: rankKey, rank: new Map(list) }); }).catch(() => { if (on) setRankFor({ key: rankKey, rank: new Map() }); });
    return () => { on = false; };
  }, [rankKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  const rank = rankFor && rankFor.key === rankKey ? rankFor.rank : null;
  const ranking = rankKey !== '';            // a Pin or Tent view is asked for
  const rankLoading = ranking && rank === null;
  // STARRED ONLY (user, 2026-10-06: 'stars apply throughout the app') — the same stars the journal uses
  const [starsOnly, setStarsOnly] = useState(false);
  const stars = useStars();
  const [open, setOpen] = useState<'role' | 'group' | null>(null);   // the open dropdown, Field Notes style (user, 2026-10-06)
  // pagination resets with the filters: the count is remembered against the filter key
  const [shownBy, setShownBy] = useState<{ key: string; n: number }>({ key: '', n: PAGE });

  // ONLY CARDS WITH A PHOTO (user, 2026-10-08, of a blank Acantholycosa pedestris
  // card): the deck has always left photo-less species out (ecoregions.ts), and
  // so do sightings; this list showed them anyway. A trading card is its picture.
  // Here, and only here, an iNaturalist fill-in counts as the picture.
  const cards = useMemo(() => (ready ? getCards().filter(c => !!photoForDb(c.id)) : []), [ready]);
  const groups = useMemo(() => [...new Set(cards.map(c => c.group))].sort(), [cards]);
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const out: Card[] = [];
    for (const c of cards) {
      if (group && c.group !== group) continue;
      if (role && c.trophic !== role) continue;
      if (ranking && !(rank && rank.has(c.id))) continue;
      if (starsOnly && !stars.has(c.id)) continue;
      if (needle && !c.name.toLowerCase().includes(needle) && !c.sci.toLowerCase().includes(needle)) continue;
      out.push(c);
    }
    // Pin and Tent: most-recorded first — WITHIN ITS GROUP (user, 2026-10-06:
    // "birds are dominating"): GBIF's records are mostly eBird, so by raw count
    // birds swamp the list. Each species scores by its share of its own
    // group's records here, so the top plant, insect and mammal sit beside the
    // top bird. All: by name
    if (ranking && rank) {
      // interleaved: every group's most-recorded species first (those ordered
      // by records), then every group's second, and so on — a lone species in
      // a small group can't outrank the whole list on share alone
      const n = (c: Card) => rank.get(c.id) ?? 0;
      const byGroup = new Map<string, Card[]>();
      for (const c of out) { if (!byGroup.has(c.group)) byGroup.set(c.group, []); byGroup.get(c.group)!.push(c); }
      const pos = new Map<string, number>();
      for (const list of byGroup.values()) list.sort((a, b) => n(b) - n(a)).forEach((c, i) => pos.set(c.species_id + '', i));
      return out.sort((a, b) => (pos.get(a.species_id + '')! - pos.get(b.species_id + '')!) || (n(b) - n(a)));
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [cards, group, role, ranking, rank, starsOnly, stars, needle]);
  const countIf = (patch: { group?: string | null; role?: string | null }) => {
    const g = patch.group !== undefined ? patch.group : group, r = patch.role !== undefined ? patch.role : role;
    let n = 0;
    for (const c of cards) {
      if (g && c.group !== g) continue;
      if (r && c.trophic !== r) continue;
      if (ranking && !(rank && rank.has(c.id))) continue;
      if (starsOnly && !stars.has(c.id)) continue;
      if (needle && !c.name.toLowerCase().includes(needle) && !c.sci.toLowerCase().includes(needle)) continue;
      n++;
    }
    return n;
  };
  const filterKey = `${needle}|${group}|${role}|${rankKey}|${where}|${starsOnly}`;
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
      <View style={{ marginBottom: 12 }}>
        <GlassSegments value={where} onChange={setWhere} items={[
          // Camp · Ecoregion · All, left to right (user, 2026-11-16; All was first)
          { key: 'pin', label: '⛺ Camp' },   // "Camp" (user, 2026-11-16; was "📍 Pin")
          { key: 'tent', label: 'Ecoregion', icon: <EcoregionIcon size={17} /> },   // "Ecoregion" (user, 2026-10-07; was "Tent"); a drawn region, not the tent (2026-11-16)
          { key: 'all', label: '🌲 All' }   // the tree, PolygroveDB's own emoji (user, 2026-11-16)
        ]} />
      </View>
      {where === 'pin' && !spot ? <Text style={s.hint}>Press “Camp here” on the Map tab first — this lists what is seen closest to your camp.</Text> : null}
      {where === 'tent' && !eco ? <Text style={s.hint}>Choose a camp first — this lists what is seen in its ecoregion.</Text> : null}
      {where === 'pin' && spot ? <Text style={s.hint}>Most likely to be seen near your camp{eco?.name ? ` · ${eco.name}` : ''}</Text> : null}
      {where === 'tent' && eco ? <Text style={s.hint}>Most likely to be seen in {eco.name}</Text> : null}
      <View style={s.filterRow}>
        <FilterBtn label="Role" value={role ?? undefined} color={role ? TROPHIC_COLOR[role] : undefined} count={rows.length}
          open={open === 'role'} onPress={() => setOpen(open === 'role' ? null : 'role')} />
        <FilterBtn label="Taxonomy" value={group ?? undefined} color={group ? C.greenSoft : undefined} count={rows.length}
          open={open === 'group'} onPress={() => setOpen(open === 'group' ? null : 'group')} />
        {/* the camp box in the tab bar's liquid glass (user, 2026-10-06): a frosted
            tile, and when on, the green-glass thumb with its top shine */}
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
          keyExtractor={c => String(c.species_id)}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          onEndReachedThreshold={0.6}
          onEndReached={() => setShownBy(prev => ({ key: filterKey, n: Math.min(rows.length, (prev.key === filterKey ? prev.n : PAGE) + PAGE) }))}
          ListEmptyComponent={!ready || rankLoading ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : <Text style={s.msg}>No species match.</Text>}
          renderItem={({ item: c }) => {
            const tc = TROPHIC_COLOR[c.trophic] || C.greenSoft;
            return (
              <Pressable onPress={() => router.push({ pathname: '/species/[id]', params: { id: c.id } })} style={s.row}>
                <HexThumb uri={photoForDb(c.id, 120)} width={46} height={52} borderColor={tc} borderWidth={2.5} />
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
  hint: { fontFamily: F.sans, fontSize: 11.5, color: '#777', textAlign: 'center', marginBottom: 10 },
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
