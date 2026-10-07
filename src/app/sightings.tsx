// SIGHTINGS (the third tab; user, 2026-10-05 — Social is parked): say which
// iNaturalist account is yours, and every species you have observed that the
// community has confirmed becomes a card in the game, in the journal of the
// ecoregion where you saw it. Free; a duplicate does nothing. The rest of
// what you have seen is here too: sightings still waiting to be confirmed,
// and POTENTIAL cards — species the game can't make a card of yet, with what
// is missing. No sign-in: the account is taken on trust until iNaturalist
// approves sign-in. The rules live in lib/sightings.ts.

import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import HexPhoto from '../components/HexPhoto';
import GlassSegments from '../components/GlassSegments';
import Honeycomb, { Comb, ShownCard } from '../components/Honeycomb';
import ViewToggle from '../components/ViewToggle';
import { ViewMode, useViewMode } from '../lib/viewmode';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { cardById, framingFor, loadCatalog, photoFor } from '../lib/catalog';
import { Naturalist, searchNaturalists } from '../lib/inatPublic';
import { ALL_FACTS, Earned, chooseMe, forgetMe, loadSightings, niceDate, partialCard, smallPhoto, syncSightings, useSightings, useSightingsRun } from '../lib/sightings';
import PolygroveCard from '../components/PolygroveCard';
import { openWeb } from '../lib/web';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STALE_MS = 60 * 60 * 1000;   // coming back to the tab probes for new sightings after an hour (a probe is two tiny requests; a full pass only if the counts moved)

export default function Sightings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const st = useSightings();
  const run = useSightingsRun();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; list: Naturalist[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState<Naturalist | null>(null);   // the account being confirmed
  // ONE list at a time, chosen on a glass selector (user, 2026-10-06; the
  // three fold-down lists before that)
  const [tab, setTab] = useState<'cards' | 'waiting' | 'potential'>('cards');
  // ONE card shown at a time, above the combs (user, 2026-10-06): the picked
  // cell from whichever comb; the key is unique across the three
  const [shown, setShown] = useState<string | null>(null);
  // HEXES OR THE LIST (user, 2026-10-06): a switch above the combs, remembered
  const [view, setView] = useViewMode('sightings', 'hex');
  // cards in the order you saw them, NEWEST first (user, 2026-10-05; oldest first for a minute)
  const earned = [...st.earned].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.at - a.at);

  useEffect(() => {
    loadSightings().then(() => setReady(true));
    loadCatalog().catch(() => { /* the earned list just shows names until it loads */ });
  }, []);

  // search as you type, a beat after the last key
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = (t: string) => {
    setQ(t); setPick(null);
    if (timer.current) clearTimeout(timer.current);
    if (t.trim().length < 2) { setFound(null); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(() => {
      searchNaturalists(t).then(list => setFound({ q: t, list })).catch(() => setFound({ q: t, list: [] })).finally(() => setSearching(false));
    }, 350);
  };
  const itsMe = (p: Naturalist) => { chooseMe(p); setQ(''); setFound(null); setPick(null); syncSightings(); };

  // check again whenever the tab comes forward and the last look is old
  const meId = st.me?.id, checkedAt = st.checkedAt;
  useFocusEffect(useCallback(() => {
    if (ready && meId != null && Date.now() - checkedAt > STALE_MS) syncSightings();
  }, [ready, meId, checkedAt]));

  // your custom view of the card — your photo and the observation — with the
  // journal's plain card one tap further (app/preview.tsx)
  const openCard = (e: Earned) => router.push({ pathname: '/preview', params: { kind: 'earned', key: `${e.eid}:${e.speciesId}` } });
  // waiting and potential sightings open "as they could be" (user, 2026-10-05)
  const preview = (kind: 'waiting' | 'potential', key: string) => router.push({ pathname: '/preview', params: { kind, key } });
  const me = st.me;
  // built once per data change (useMemo): 3,000+ cells rebuilt on every tap made the tab slow (2026-10-06)
  const earnedCombs = useMemo<Comb[]>(() => earned.map(e => combOf(e.photo, e.cardId, { key: `${e.eid}:${e.speciesId}`, name: e.name, date: e.date,
                  sub: cardById(e.cardId)?.sci, meta: `Journaled in ${e.eco}${e.date ? ` · seen ${niceDate(e.date)}` : ''}`, onOpen: () => openCard(e),
                  card: () => { const c = cardById(e.cardId); return c ? <PolygroveCard card={c} sighting={e} /> : null; } })), [earned]);   // eslint-disable-line react-hooks/exhaustive-deps
  const waitingCombs = useMemo<Comb[]>(() => st.waiting.map(w => combOf(w.photo, w.cardId, { key: String(w.obsId), name: w.name, sub: w.sci, date: w.date,
                  meta: `${w.cardId ? 'a card once confirmed' : 'not a card yet'}${w.date ? ` · ${niceDate(w.date)}` : ''}`, onOpen: () => preview('waiting', String(w.obsId)),
                  card: () => { const c = w.cardId ? cardById(w.cardId) : undefined; return <PolygroveCard card={c ?? partialCard(w.name, w.sci, w.facts)} sighting={w} missing={c ? undefined : w.facts?.missing ?? ALL_FACTS} />; } }, w.facts?.trophic)), [st.waiting]);   // eslint-disable-line react-hooks/exhaustive-deps
  const potentialCombs = useMemo<Comb[]>(() => st.potential.map(p => combOf(p.obs.photo, p.cardId, { key: p.key, name: p.name + (p.seen > 1 ? `  ×${p.seen}` : ''), sub: p.sci, date: p.obs.date,
                  meta: p.why, onOpen: () => preview('potential', p.key),
                  card: () => { const c = p.cardId ? cardById(p.cardId) : undefined; return <PolygroveCard card={c ?? partialCard(p.name, p.sci, p.facts)} sighting={{ ...p.obs, seen: p.seen }} missing={c ? undefined : p.facts?.missing ?? ALL_FACTS} />; } }, p.facts?.trophic)), [st.potential]);   // eslint-disable-line react-hooks/exhaustive-deps
  // the list on show, with ITS FIRST CARD selected until you pick another
  // (user, 2026-10-06: "automatically have the first card selected")
  const allCells = tab === 'cards' ? earnedCombs : tab === 'waiting' ? waitingCombs : potentialCombs;
  // THE LIST'S MONTH AND YEAR (user, 2026-10-06: "when it's on the list view
  // have the journal button be month … and iNaturalist button be year"): two
  // pickers over the dates in the list; the hexes are never filtered
  const [month, setMonth] = useState<number | null>(null);   // 1–12
  const [year, setYear] = useState<number | null>(null);
  const [pickOpen, setPickOpen] = useState<'month' | 'year' | null>(null);
  const years = useMemo(() => [...new Set(allCells.map(c => c.date?.slice(0, 4)).filter((y): y is string => !!y))].sort().reverse(), [allCells]);
  const months = useMemo(() => [...new Set(allCells.filter(c => !year || c.date?.startsWith(String(year))).map(c => c.date ? Number(c.date.slice(5, 7)) : 0).filter(m => m > 0))].sort((a, b) => a - b), [allCells, year]);
  const cells = view === 'list' && (month || year)
    ? allCells.filter(c => c.date && (!year || c.date.startsWith(String(year))) && (!month || Number(c.date.slice(5, 7)) === month))
    : allCells;
  const shownKey = shown && cells.some(c => c.key === shown) ? shown : cells[0]?.key ?? null;
  // the shown card's two links (user, 2026-10-06: "to the right of this put two
  // buttons, journal and iNaturalist"): the game's card, and the observation
  const shownLinks = (() => {
    if (!shownKey) return { cardId: null as string | null, eid: null as number | null, uri: undefined as string | undefined };
    if (tab === 'cards') { const e = earned.find(x => `${x.eid}:${x.speciesId}` === shownKey); return { cardId: e?.cardId ?? null, eid: e?.eid ?? null, uri: e?.uri }; }
    if (tab === 'waiting') { const w = st.waiting.find(x => String(x.obsId) === shownKey); return { cardId: null, eid: null, uri: w?.uri }; }   // not in a journal yet
    const p = st.potential.find(x => x.key === shownKey); return { cardId: null, eid: null, uri: p?.obs.uri };
  })();

  return (
    <View style={s.root}>
      <GreenBackdrop />
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}>
        <View style={s.head}>
          <Text style={s.title}>Sightings</Text>
          <Text style={s.beta}>(beta)</Text>
          <Text style={s.sub}>what you’ve seen on iNaturalist, as cards</Text>
        </View>

        {!ready ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : !me ? (
          <>
            <View style={s.card}>
              <Text style={s.globe}>📷</Text>
              <Text style={s.cardTitle}>Which account is yours?</Text>
              <Text style={s.cardTxt}>
                Find your iNaturalist account. Every species you’ve observed that the community has confirmed becomes a
                card, in the ecoregion where you saw it.
              </Text>
            </View>
            <TextInput value={q} onChangeText={onType} placeholder="Your iNaturalist username…" placeholderTextColor="#666"
              autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={[s.search, { marginTop: 14 }]} />
            {searching && <ActivityIndicator color={C.green} style={{ marginVertical: 10 }} />}
            {pick ? (
              <View style={s.confirm}>
                <Person p={pick} />
                <Text style={s.confirmTxt}>Is this you? Your confirmed sightings will be turned into cards.</Text>
                <View style={s.confirmBtns}>
                  <Pressable onPress={() => setPick(null)} style={[s.btn, s.btnQuiet]}><Text style={[s.btnTxt, { color: '#ccc' }]}>Not me</Text></Pressable>
                  <Pressable onPress={() => itsMe(pick)} style={s.btn}><Text style={s.btnTxt}>This is me</Text></Pressable>
                </View>
              </View>
            ) : found && !searching && (
              found.list.length === 0 ? <Text style={s.empty}>No account matches “{found.q}”.</Text>
                : found.list.map(p => <Person key={p.id} p={p} onPress={() => setPick(p)} />)
            )}
          </>
        ) : (
          <>
            <View style={s.me}>
              {me.icon ? <Image source={{ uri: me.icon }} style={s.avatar} contentFit="cover" /> : <View style={[s.avatar, s.center]}><Text style={{ fontSize: 26 }}>🌿</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.meName} numberOfLines={1}>{me.name || me.login}</Text>
                <Pressable onPress={() => openWeb(`https://www.inaturalist.org/people/${me.login}`)} hitSlop={6}>
                  <Text style={s.meLogin} numberOfLines={1}>@{me.login} · iNaturalist ›</Text>
                </Pressable>
              </View>
              <Pressable onPress={forgetMe} hitSlop={8} disabled={run.busy}><Text style={s.change}>Not you?</Text></Pressable>
            </View>

            <Pressable onPress={() => syncSightings(true)} disabled={run.busy} style={[s.check, run.busy && { opacity: 0.6 }]}>
              {run.busy ? <ActivityIndicator color={C.text} size="small" /> : null}
              <Text style={s.checkTxt}>{run.busy ? run.step ?? 'Checking…' : 'Check for new sightings'}</Text>
            </Pressable>
            {run.err ? <Text style={s.err}>{run.err}</Text> : null}

            <View style={s.stats}>
              <Stat n={st.earned.length} label="Cards earned" />
              <Stat n={st.waitingTotal} label="Waiting" />
              <Stat n={st.potentialTotal} label="Potential" />
            </View>
            {!run.busy && st.checkedAt > 0 ? (
              <Text style={s.note}>
                {st.confirmed.toLocaleString()} confirmed sighting{st.confirmed === 1 ? '' : 's'}
                {st.already ? ` · ${st.already} already in your journals` : ''}
                {st.unplaced ? ` · ${st.unplaced} with no ecoregion at that spot` : ''}
              </Text>
            ) : null}
            {run.fresh && run.fresh.length > 0 ? (
              <View style={s.fresh}>
                <Text style={s.freshTxt}>
                  {run.fresh.length} new card{run.fresh.length === 1 ? '' : 's'} from your sightings
                </Text>
              </View>
            ) : null}

            {/* the selector first, the Hexes/List switch under it (user, 2026-10-06) */}
            <View style={{ marginTop: 30, marginBottom: 14 }}>
              <GlassSegments value={tab} onChange={setTab} items={[
                // the counts wear the map's mark colours (user, 2026-10-06): confirmed yellow, waiting green, potential grey
                { key: 'cards', label: 'Sightings', n: earned.length, color: C.yellow },
                { key: 'waiting', label: 'Unconfirmed', n: st.waitingTotal, color: '#5fe35a' },
                { key: 'potential', label: 'Potential', n: st.potentialTotal, color: '#bbbbbb' },
              ]} />
            </View>
            <View style={s.toolRow}>
              <ViewToggle mode={view} onChange={setView} />
              {view === 'hex' ? (
                <>
                  <Pressable disabled={!shownLinks.cardId} onPress={() => shownLinks.cardId && router.push({ pathname: '/deck', params: { glow: shownLinks.cardId, eid: String(shownLinks.eid ?? ''), slide: 'right' } })}
                    style={[s.tool, !shownLinks.cardId && { opacity: 0.35 }]}><Text style={s.toolTxt}>📖 Journal</Text></Pressable>
                  <Pressable disabled={!shownLinks.uri} onPress={() => shownLinks.uri && openWeb(shownLinks.uri)}
                    style={[s.tool, !shownLinks.uri && { opacity: 0.35 }]}><Text style={s.toolTxt}>iNaturalist ›</Text></Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => setPickOpen(pickOpen === 'month' ? null : 'month')} style={[s.tool, (!!month || pickOpen === 'month') && s.toolOn]}>
                    <Text style={s.toolTxt}>{month ? MONTHS[month - 1] : 'Month'} {pickOpen === 'month' ? '▴' : '▾'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setPickOpen(pickOpen === 'year' ? null : 'year')} style={[s.tool, (!!year || pickOpen === 'year') && s.toolOn]}>
                    <Text style={s.toolTxt}>{year ?? 'Year'} {pickOpen === 'year' ? '▴' : '▾'}</Text>
                  </Pressable>
                </>
              )}
            </View>
            {view === 'list' && pickOpen ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                <Pressable onPress={() => { (pickOpen === 'month' ? setMonth : setYear)(null); setPickOpen(null); }} style={[s.chip, !(pickOpen === 'month' ? month : year) && s.chipOn]}><Text style={s.chipTxt}>All</Text></Pressable>
                {pickOpen === 'month'
                  ? months.map(m => <Pressable key={m} onPress={() => { setMonth(month === m ? null : m); setPickOpen(null); }} style={[s.chip, month === m && s.chipOn]}><Text style={s.chipTxt}>{MONTHS[m - 1]}</Text></Pressable>)
                  : years.map(y => <Pressable key={y} onPress={() => { setYear(year === Number(y) ? null : Number(y)); setMonth(null); setPickOpen(null); }} style={[s.chip, year === Number(y) && s.chipOn]}><Text style={s.chipTxt}>{y}</Text></Pressable>)}
              </ScrollView>
            ) : null}
            {view === 'hex' && shownKey ? <ShownCard cells={cells} picked={shownKey} onPick={setShown} /> : null}
            {tab === 'cards' ? (earned.length === 0 ? (
              <Text style={s.empty}>
                {st.checkedAt === 0 ? 'Checking your sightings…' : 'None yet. A confirmed sighting of a species in the game becomes a card here.'}
              </Text>
            ) : <Cells cells={earnedCombs} view={view} picked={shownKey} onPick={setShown} />) : null}

            {tab === 'waiting' ? (st.waiting.length === 0 ? <Text style={s.empty}>Nothing waiting.</Text> : (
              <>
                <Text style={s.hint}>These need the iNaturalist community to agree on what they are. Tap one to see what it is, again to see the card it could be.</Text>
                <Cells cells={waitingCombs} view={view} picked={shownKey} onPick={setShown} />
                {/* the comb holds the newest 200 named down to a species; the rest of the count has not got that far */}
                {st.waitingTotal > st.waiting.length ? (
                  <Text style={s.more}>{st.waitingTotal - st.waiting.length} more aren’t identified down to a species yet</Text>
                ) : null}
              </>
            )) : null}

            {tab === 'potential' ? (st.potential.length === 0 ? <Text style={s.empty}>Nothing here — everything you’ve had confirmed is a card.</Text> : (
              <>
                <Text style={s.hint}>You’ve seen these, but the game can’t make the card yet. Tap one to see what it is, again to see it as it could be.</Text>
                <Cells cells={potentialCombs} view={view} picked={shownKey} onPick={setShown} />
                {st.potentialTotal > st.potential.length ? <Text style={s.more}>and {st.potentialTotal - st.potential.length} more</Text> : null}
              </>
            )) : null}
          </>
        )}

        <Pressable onPress={() => router.push('/about')} hitSlop={8} style={s.about}>
          <Text style={s.aboutTxt}>About Polygrove · sources and photo credits ›</Text>
        </Pressable>
      </ScrollView>
      <BottomNav active="sightings" />
    </View>
  );
}

function Person({ p, onPress }: { p: Naturalist; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.person}>
      {p.icon ? <Image source={{ uri: p.icon }} style={s.pic} contentFit="cover" /> : <View style={[s.pic, s.center]}><Text>🌿</Text></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.pName} numberOfLines={1}>{p.name || p.login}</Text>
        <Text style={s.pMeta} numberOfLines={1}>@{p.login} · {p.observations.toLocaleString()} observations</Text>
      </View>
      {onPress ? <Text style={s.chev}>›</Text> : null}
    </Pressable>
  );
}

// a category's cards, as the comb or as the list rows the tab had before
// (user, 2026-10-06: "switch between the hexes and the previous way")
function Cells({ cells, view, picked, onPick }: { cells: Comb[]; view: ViewMode; picked: string | null; onPick: (k: string | null) => void }) {
  if (view === 'hex') return <Honeycomb cells={cells} picked={picked} onPick={onPick} />;
  return (
    <>
      {cells.slice(0, 60).map(c => (
        <Pressable key={c.key} onPress={c.onOpen} style={s.person}>
          <HexPhoto uri={c.uri} frame={c.frame} width={46} height={52} borderColor={c.border} borderWidth={2.5} />
          <View style={{ flex: 1 }}>
            <Text style={s.pName} numberOfLines={1}>{c.name}</Text>
            {c.sub ? <Text style={[s.pMeta, { fontStyle: 'italic' }]} numberOfLines={1}>{c.sub}</Text> : null}
            {c.meta ? <Text style={s.pMeta} numberOfLines={2}>{c.meta}</Text> : null}
          </View>
          <Text style={s.chev}>›</Text>
        </Pressable>
      ))}
      {cells.length > 60 ? <Text style={s.more}>and {cells.length - 60} more — the hexes show them all</Text> : null}
    </>
  );
}

// one honeycomb cell (user, 2026-10-05): your photo; the game's photo when the
// species is a card and you shared none; the border is the card's feeding
// colour, or grey for a species that is no card yet
// the border is the TROPHIC colour whenever the role is known — from the deck
// card, or from the database's facts for a species that is no card yet (a
// paintbrush is a Producer whether or not it has a size); grey ONLY when the
// role itself is unknown (user, 2026-10-06)
function combOf(photo: string | null | undefined, cardId: string | null, rest: Omit<Comb, 'uri' | 'frame' | 'border' | 'fallback'>, trophic?: string | null): Comb {
  const card = cardId ? cardById(cardId) : undefined;
  const role = card?.trophic || trophic || '';
  const border = role ? TROPHIC_COLOR[role] || C.greenSoft : '#666';
  const uri = smallPhoto(photo) || (cardId ? photoFor(cardId, 250) : undefined);
  return { ...rest, uri, frame: photo || !cardId ? undefined : framingFor(cardId), border, fallback: '🌿' };
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.statN}>{n.toLocaleString()}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginBottom: 18 },
  title: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34 },
  beta: { fontFamily: F.sansBold, fontSize: 11, color: C.yellow, letterSpacing: 1.2, marginTop: -2 },   // (user, 2026-10-05)
  sub: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginTop: 4 },
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
  confirm: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(76,175,80,0.35)', backgroundColor: 'rgba(76,175,80,0.07)', gap: 4 },
  confirmTxt: { fontFamily: F.sans, fontSize: 12.5, color: '#bbb', lineHeight: 18, paddingHorizontal: 2 },
  confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 22, alignItems: 'center', backgroundColor: '#2E7D32' },
  btnQuiet: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333' },
  btnTxt: { fontFamily: F.display, fontSize: 13, color: C.text },
  me: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1c2a1c', borderWidth: 2, borderColor: 'rgba(129,199,132,0.4)' },
  meName: { fontFamily: F.display, fontSize: 16, color: C.text },
  meLogin: { fontFamily: F.sansBold, fontSize: 11.5, color: C.greenSoft, marginTop: 2 },
  change: { fontFamily: F.sans, fontSize: 11.5, color: '#777' },
  stats: {
    flexDirection: 'row', paddingVertical: 12, borderRadius: 16, marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(129,199,132,0.22)',
  },
  statN: { fontFamily: F.display, fontSize: 20, color: C.green },
  statL: { fontFamily: F.sansBold, fontSize: 9.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  check: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#2E7D32',
  },
  checkTxt: { fontFamily: F.display, fontSize: 13, color: C.text, flexShrink: 1 },
  err: { fontFamily: F.sans, fontSize: 12, color: '#E57373', textAlign: 'center', lineHeight: 17, marginTop: 8 },
  note: { fontFamily: F.sans, fontSize: 11, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  fresh: { marginTop: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,225,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,225,77,0.4)' },
  freshTxt: { fontFamily: F.sansBold, fontSize: 12.5, color: C.yellow, textAlign: 'center' },
  hint: { fontFamily: F.sans, fontSize: 11.5, color: '#777', lineHeight: 16.5, marginBottom: 8 },
  empty: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, paddingVertical: 14 },
  // the Hexes/List switch with the shown card's two links beside it, in the switch's own style
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  tool: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: '#2a2a2a' },
  toolTxt: { fontFamily: F.sansBold, fontSize: 11.5, color: C.greenSoft },
  toolOn: { backgroundColor: 'rgba(76,175,80,0.22)', borderColor: 'rgba(76,175,80,0.4)' },
  chips: { gap: 7, paddingBottom: 12, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { borderColor: 'rgba(76,175,80,0.5)', backgroundColor: 'rgba(76,175,80,0.2)' },
  chipTxt: { fontFamily: F.sansMed, fontSize: 12, color: C.text },
  more: { fontFamily: F.sans, fontSize: 11.5, color: '#666', textAlign: 'center', paddingVertical: 6 },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, marginBottom: 8,
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a',
  },
  pic: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1c2a1c' },
  pName: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  pMeta: { fontFamily: F.sans, fontSize: 11.5, color: '#888', marginTop: 1 },
  chev: { fontFamily: F.sansBold, fontSize: 18, color: '#555' },
  about: { alignItems: 'center', marginTop: 30 },
  aboutTxt: { fontFamily: F.sans, fontSize: 11.5, color: '#666' },
});
