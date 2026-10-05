// PARKED (user, 2026-10-05: "the whole social aspect we scrap for now"). The
// tab is Sightings now (app/sightings.tsx) and nothing links here. Kept, with
// lib/follows.ts, lib/custom.ts, components/SightingRow.tsx,
// components/ObservationCard.tsx, app/naturalist/[login].tsx and
// app/custom/[id].tsx, for when following people and custom cards come back.
// SOCIAL (user, 2026-09-29) — iNaturalist without signing in: find accounts,
// follow them, look at what they have seen, and BUY the card of anything in
// the deck for 10 Sol. All from iNaturalist's public data; who you follow is
// kept on this phone only. (Real sign-in waits on iNaturalist's approval —
// lib/inat.ts.) About lives on as a link at the foot.

import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import HexPhoto from '../components/HexPhoto';
import { CUSTOM_ACCENT } from '../components/ObservationCard';
import SightingRow from '../components/SightingRow';
import { C, F } from '../constants/polygrove';
import { loadCustom, useCustomCards } from '../lib/custom';
import { loadFollows, useFollows } from '../lib/follows';
import { Naturalist, Sighting, feed, searchNaturalists } from '../lib/inatPublic';
import { loadSol, useSol } from '../lib/sol';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';

export default function Social() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const follows = useFollows();
  const balance = useSol();
  const cards = useCustomCards();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; list: Naturalist[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<{ key: string; list: Sighting[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadFollows(), loadSol(), loadCustom()]).then(() => setReady(true));
  }, []);

  // search as you type, a beat after the last key
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = (t: string) => {
    setQ(t);
    if (timer.current) clearTimeout(timer.current);
    if (t.trim().length < 2) { setFound(null); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      searchNaturalists(t).then(list => setFound({ q: t, list })).catch(() => setFound({ q: t, list: [] })).finally(() => setSearching(false));
    }, 350);
  };

  // the feed: what the people you follow have shared, refreshed whenever the tab comes forward
  const key = follows.map(f => f.id).sort((a, b) => a - b).join(',');
  useFocusEffect(useCallback(() => {
    if (!ready || !key) return;
    let live = true;
    feed(key.split(',').map(Number)).then(list => { if (live) { setItems({ key, list }); setErr(null); } })
      .catch(() => { if (live) setErr('iNaturalist can’t be reached right now.'); });
    return () => { live = false; };
  }, [ready, key]));
  const list = items?.key === key ? items.list : null;
  const open = (login: string) => router.push({ pathname: '/naturalist/[login]', params: { login } });

  return (
    <View style={s.root}>
      <GreenBackdrop />
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}>
        <View style={s.head}>
          <Text style={s.title}>Social</Text>
          <Text style={s.sub}>sightings from iNaturalist · {balance} Sol 🔆</Text>
        </View>

        <TextInput value={q} onChangeText={onType} placeholder="Find an iNaturalist account…" placeholderTextColor="#666"
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={s.search} />
        {searching && <ActivityIndicator color={C.green} style={{ marginVertical: 10 }} />}
        {found && !searching && (
          found.list.length === 0 ? <Text style={s.empty}>No account matches “{found.q}”.</Text>
            : found.list.map(p => <Person key={p.id} p={p} onPress={() => open(p.login)} />)
        )}

        {/* YOUR CARDS (2026-10-05): the custom cards you have bought, newest
            first — each one an observation, not a card from the base game */}
        {!found && ready && cards.length > 0 && (
          <>
            <Text style={s.section}>Your cards · {cards.length}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }} style={{ marginBottom: 18 }}>
              {cards.map(c => (
                <Pressable key={c.id} onPress={() => router.push({ pathname: '/custom/[id]', params: { id: String(c.id) } })} style={s.mine}>
                  <HexPhoto uri={c.photo} width={76} height={86} borderColor={CUSTOM_ACCENT} borderWidth={3} />
                  <Text style={s.mineTxt} numberOfLines={1}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {!found && (
          !ready ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
            : follows.length === 0 ? (
              <View style={s.card}>
                <Text style={s.globe}>🌎</Text>
                <Text style={s.cardTitle}>Follow a naturalist</Text>
                <Text style={s.cardTxt}>
                  Search for anyone on iNaturalist and follow them. What they have seen shows up here, and any
                  sighting with a photo they shared for reuse can be bought for 10 Sol as a custom card.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.section}>Following</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 6 }}>
                  {follows.map(p => (
                    <Pressable key={p.id} onPress={() => open(p.login)} style={s.chip}>
                      {p.icon ? <Image source={{ uri: p.icon }} style={s.chipPic} contentFit="cover" /> : <View style={[s.chipPic, s.center]}><Text>🌿</Text></View>}
                      <Text style={s.chipTxt} numberOfLines={1}>@{p.login}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[s.section, { marginTop: 18 }]}>Latest sightings</Text>
                {err ? <Text style={s.empty}>{err}</Text>
                  : list == null ? <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />
                  : list.length === 0 ? <Text style={s.empty}>Nothing shared yet.</Text>
                  : list.map(o => <SightingRow key={o.id} s={o} showBy />)}
              </>
            )
        )}

        <Pressable onPress={() => router.push('/about')} hitSlop={8} style={s.about}>
          <Text style={s.aboutTxt}>About Polygrove · sources and photo credits ›</Text>
        </Pressable>
      </ScrollView>
      <BottomNav active="sightings" />
    </View>
  );
}

export function Person({ p, onPress }: { p: Naturalist; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.person}>
      {p.icon ? <Image source={{ uri: p.icon }} style={s.pic} contentFit="cover" /> : <View style={[s.pic, s.center]}><Text>🌿</Text></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.pName} numberOfLines={1}>{p.name || p.login}</Text>
        <Text style={s.pMeta} numberOfLines={1}>@{p.login} · {p.observations.toLocaleString()} observations</Text>
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginBottom: 18 },
  title: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34 },
  sub: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginTop: 2 },
  search: {
    fontFamily: F.sans, fontSize: 14, color: C.text, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333', marginBottom: 14,
  },
  card: {
    alignItems: 'center', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)',
    backgroundColor: 'rgba(76,175,80,0.08)', marginTop: 6,
  },
  globe: { fontSize: 42, marginBottom: 8, opacity: 0.72 },
  cardTitle: { fontFamily: F.display, fontSize: 19, color: C.text, marginBottom: 8 },
  cardTxt: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19 },
  section: { fontFamily: F.sansBold, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  empty: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, paddingVertical: 20 },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, marginBottom: 8,
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a',
  },
  pic: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1c2a1c' },
  pName: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  pMeta: { fontFamily: F.sans, fontSize: 11.5, color: '#888', marginTop: 1 },
  chev: { fontFamily: F.sansBold, fontSize: 18, color: '#555' },
  chip: { alignItems: 'center', width: 70, gap: 5 },
  chipPic: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#1c2a1c', borderWidth: 2, borderColor: 'rgba(129,199,132,0.4)' },
  chipTxt: { fontFamily: F.sansMed, fontSize: 10, color: '#aaa', maxWidth: 70 },
  mine: { alignItems: 'center', width: 84, gap: 5 },
  mineTxt: { fontFamily: F.sansMed, fontSize: 10, color: '#aaa', maxWidth: 84 },
  about: { alignItems: 'center', marginTop: 30 },
  aboutTxt: { fontFamily: F.sans, fontSize: 11.5, color: '#666' },
});
