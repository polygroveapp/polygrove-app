// SPECIES — the demo's "Field Notes" screen (App.jsx screen === "web", mock
// 2026-09-26): the ecoregion's whole deck as a 3-column grid of 3:4 cards.
// Journaled cards show their photo, name and mastery tier; the rest sit dark
// with a ❓ and "???" until you find them. Needs the catalog → online-only;
// the Journal is the offline view.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import HexPhoto from '../components/HexPhoto';
import ViewToggle from '../components/ViewToggle';
import { useStars } from '../lib/stars';
import { useViewMode } from '../lib/viewmode';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackChevron from '../components/BackChevron';
import Honeycomb, { Comb, ShownCard } from '../components/Honeycomb';
import PolygroveCard from '../components/PolygroveCard';
import QuizButton from '../components/QuizButton';
import { ALL_TIERS, C, F, MASTERY, TROPHIC_COLOR, TROPHIC_ORDER, getLevel, getTier } from '../constants/polygrove';
import { Card, framingFor, loadCatalog, photoFor } from '../lib/catalog';
import { loadCollection, owns, useCollection, ownedAt } from '../lib/collection';
import { CurrentEco, ecoMembers, ecoMeta, loadCurrentEco, loadEcoMeta, useCurrentEco } from '../lib/ecoregions';
import { loadMastery, scoreOf, useMastery } from '../lib/mastery';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';

export default function FieldNotes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // eid = another ecoregion's journal than the camp's (a sighting's "Find
  // card in journal"; user, 2026-10-06); otherwise the camp
  const { glow, eid: eidParam } = useLocalSearchParams<{ glow?: string; eid?: string; slide?: string }>();
  const camp = useCurrentEco();
  const [other, setOther] = useState<CurrentEco | null>(null);
  const wantEid = eidParam ? Number(eidParam) : null;
  useEffect(() => {
    if (wantEid === null || wantEid === camp?.eid) return;
    let on = true;
    loadEcoMeta().then(() => { const m = ecoMeta(wantEid); if (on && m) setOther({ eid: wantEid, name: m.name, bbox: m.bbox, size: 0, lead: m.lead, photo: m.photo, wiki: m.wiki }); }).catch(() => {});
    return () => { on = false; };
  }, [wantEid, camp?.eid]);
  const eco = wantEid !== null && wantEid !== camp?.eid ? other : camp;
  const owned = useCollection(eco?.eid);
  const masteryVersion = useMastery();   // tiers re-render as quizzes are won
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // HEXES OR THE TILE GRID (user, 2026-10-06: "for the field notes do it
  // vertically like you had before, but have both options") — a switch in
  // the filter bar, remembered
  const [view, setView] = useViewMode('deck', 'hex');
  // glow = the card that just went Solar (user, 2026-09-28), or the card a
  // sighting sent you to find: its tile is scrolled into view and haloed gold
  const list = useRef<SectionList<Card[]>>(null);

  const load = () =>
    Promise.all([loadCatalog(), loadCollection(), loadCurrentEco(), loadMastery()])
      .then(() => setReady(true)).catch(e => setError(String(e)));
  useEffect(() => { load(); }, []);
  const retry = () => { setError(null); load(); };

  // only what the user actually has (user, 2026-09-26): journaled cards, in
  // the ORDER THEY WERE OPENED, newest first (user, 2026-10-08: "for both hexes
  // and list they should be in order of which cards they opened"; by name
  // before). The deck's full size stays in the subtitle so progress still reads
  const deckSize = ready && eco ? ecoMembers(eco.eid).length : 0;
  const cards = useMemo(
    () => (ready && eco
      ? ecoMembers(eco.eid).filter(c => owns(eco.eid, c.species_id)).sort((a, b) => ownedAt(eco.eid, b.species_id) - ownedAt(eco.eid, a.species_id) || a.name.localeCompare(b.name))
      : []),
    [ready, eco, owned],   // eslint-disable-line react-hooks/exhaustive-deps
  );

  // three filters (user, 2026-09-26): card level · taxonomy · trophic role
  const [level, setLevel] = useState<string | null>(null);     // a mastery tier key
  const [group, setGroup] = useState<string | null>(null);
  const [trophic, setTrophic] = useState<string | null>(null);
  const [open, setOpen] = useState<'level' | 'group' | 'trophic' | null>(null);
  // STARRED ONLY (user, 2026-10-06): the fourth box, just a star
  const [starsOnly, setStarsOnly] = useState(false);
  const stars = useStars();
  const groups = useMemo(() => [...new Set(cards.map(c => c.group))].sort(), [cards]);
  const trophics = useMemo(() => TROPHIC_ORDER.filter(t => cards.some(c => c.trophic === t)), [cards]);
  // no "Undiscovered" option — a screen of identical ? tiles says nothing
  const levelOpts = ALL_TIERS.map(m => ({ key: m.key, label: m.label }));
  type Sel = { level: string | null; group: string | null; trophic: string | null; stars: boolean };
  const matches = (c: Card, sel: Sel) => {
    if (sel.stars && !stars.has(c.id)) return false;
    if (sel.group && c.group !== sel.group) return false;
    if (sel.trophic && c.trophic !== sel.trophic) return false;
    if (sel.level) return getTier(scoreOf(c.species_id)).key === sel.level;
    return true;
  };
  const cur: Sel = { level, group, trophic, stars: starsOnly };
  const rows = useMemo(() => cards.filter(c => matches(c, cur)),
    [cards, group, trophic, level, starsOnly, stars, eco, owned, masteryVersion]);   // eslint-disable-line react-hooks/exhaustive-deps
  // how many cards each option would leave, given the other two filters —
  // the count sits at the right of every chip and button (user, 2026-09-26)
  const countIf = (patch: Partial<Sel>) => cards.reduce((n, c) => n + (matches(c, { ...cur, ...patch }) ? 1 : 0), 0);
  // A HONEYCOMB (user, 2026-10-05: "do it for the regular game too"): the
  // list is a SectionList so the FILTER BAR can stick to the top (user,
  // 2026-09-28); its one item is the comb of every journaled card that
  // matches. Cells wear the LEVEL colour (the tile theme since 2026-09-26).
  // NO GALLERY SCREEN any more (user, 2026-10-06: "remove this screen"): a tap
  // shows the card above the comb, and the button under the comb takes you to
  // its Solar quiz; a tile in the grid goes straight to the quiz.
  const toQuiz = (item: Card) => router.push({ pathname: '/quiz/[id]', params: { id: item.id } });
  const [picked, setPicked] = useState<string | null>(null);
  const triples = useMemo(() => { const out: Card[][] = []; for (let i = 0; i < rows.length; i += 3) out.push(rows.slice(i, i + 3)); return out; }, [rows]);
  const combs = useMemo<Comb[]>(() => rows.map(c => {
    const t = getTier(scoreOf(c.species_id));
    return { key: c.id, uri: photoFor(c.id, 250), frame: framingFor(c.id), border: t.border, shimmer: t.key === 'solar', name: c.name, sub: c.sci,
      meta: `${t.label} level · ${c.trophic || '?'} · ${c.group}`, fallback: '🌿', onOpen: () => {}, card: () => <PolygroveCard card={c} /> };
  }), [rows, masteryVersion]);   // eslint-disable-line react-hooks/exhaustive-deps
  // the card on show: your pick while it is in the comb, else the glowing
  // card, else the first (user, 2026-10-06: "always a card selected")
  const inComb = (k: string | null | undefined) => !!k && combs.some(c => c.key === k);
  const shownKey = inComb(picked) ? picked : inComb(glow) ? glow! : combs[0]?.key ?? null;
  const shownCard = shownKey ? rows.find(c => c.id === shownKey) : undefined;
  // the fresh Solar card: the comb opens with it picked and pulsing gold; the
  // list scrolls to the comb's top
  const scrollToGlow = (retry = true) => {
    const r = rows.findIndex(c => c.id === glow);
    if (r < 0) return;
    const item = view === 'hex' ? 1 : Math.floor(r / 3) + 1;   // the comb is one item; the grid is rows of three (item 0 is the header)
    try { list.current?.scrollToLocation({ sectionIndex: 0, itemIndex: item, viewPosition: view === 'hex' ? 0 : 0.35, animated: true }); }
    catch { if (retry) setTimeout(() => scrollToGlow(false), 300); }
  };
  useEffect(() => {
    if (!glow || !ready) return;
    const t = setTimeout(() => scrollToGlow(), 400);
    return () => clearTimeout(t);
  }, [glow, ready]);   // eslint-disable-line react-hooks/exhaustive-deps

  // THE BAR WEARS THE PAGE'S GRADIENT (2026-09-29): it has to be opaque for
  // the cards to slide under, so it carries its own screen-sized copy of the
  // backdrop, shifted to wherever the bar is on screen — no flat stripe
  const win = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const headerH = useSharedValue(0);
  const sliceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, headerH.value - scrollY.value) }],
  }));

  // with the hexagons the filters, the switch and the quiz button are drawn in the
  // comb's own item, above the card (user, 2026-11-16; under the card from
  // 2026-10-11); with no card (the filters match nothing) the filters are the
  // section header, so they can be undone
  const inline = view === 'hex' && rows.length > 0;
  const filterBar = (
    <View style={[s.filters, inline && { backgroundColor: 'transparent', paddingTop: 0, paddingBottom: 0 }]}>
      {/* the backdrop slice goes FIRST: as a later sibling it painted over the
          Hexes/List switch, which showed as a blank band (user, 2026-10-06:
          "too much space here") */}
      {inline ? null : (
        <Animated.View pointerEvents="none"
          style={[{ position: 'absolute', left: 0, top: -insets.top, width: win.width, height: win.height }, sliceStyle]}>
          <GreenBackdrop />
        </Animated.View>
      )}
      {inline ? null : <View style={{ alignItems: 'center', marginBottom: 8 }}><ViewToggle mode={view} onChange={setView} /></View>}
      <View style={s.filterRow}>
        <FilterBtn label="Level" value={level ? levelOpts.find(o => o.key === level)?.label : undefined}
          color={level ? ALL_TIERS.find(m => m.key === level)?.border : undefined} count={rows.length}
          open={open === 'level'} onPress={() => setOpen(open === 'level' ? null : 'level')} />
        <FilterBtn label="Role" value={trophic ?? undefined} color={trophic ? TROPHIC_COLOR[trophic] : undefined} count={rows.length}
          open={open === 'trophic'} onPress={() => setOpen(open === 'trophic' ? null : 'trophic')} />
        <FilterBtn label="Taxonomy" value={group ?? undefined} color={group ? C.greenSoft : undefined} count={rows.length}
          open={open === 'group'} onPress={() => setOpen(open === 'group' ? null : 'group')} />
        <Pressable onPress={() => setStarsOnly(v => !v)} accessibilityRole="button" accessibilityLabel="Starred cards only"
          style={[s.filterBtn, s.starBtn, starsOnly && { borderColor: `${C.yellow}80`, backgroundColor: `${C.yellow}1f` }]}>
          <Text style={[s.starBtnTxt, starsOnly && { color: C.yellow }]}>{starsOnly ? '★' : '☆'}</Text>
        </Pressable>
      </View>
      {open && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {open === 'level' && <>
            <Chip label="All" count={countIf({ level: null })} on={!level} onPress={() => setLevel(null)} />
            {ALL_TIERS.map(m => <Chip key={m.key} label={m.label} count={countIf({ level: m.key })} on={level === m.key} color={m.border} onPress={() => setLevel(level === m.key ? null : m.key)} />)}
          </>}
          {open === 'group' && <>
            <Chip label="All" count={countIf({ group: null })} on={!group} onPress={() => setGroup(null)} />
            {groups.map(g => <Chip key={g} label={g} count={countIf({ group: g })} on={group === g} color={C.greenSoft} onPress={() => setGroup(group === g ? null : g)} />)}
          </>}
          {open === 'trophic' && <>
            <Chip label="All" count={countIf({ trophic: null })} on={!trophic} onPress={() => setTrophic(null)} />
            {trophics.map(t => <Chip key={t} label={t} count={countIf({ trophic: t })} on={trophic === t} color={TROPHIC_COLOR[t]} onPress={() => setTrophic(trophic === t ? null : t)} />)}
          </>}
        </ScrollView>
      )}
    </View>
  );

  const header = (
    <View onLayout={e => { headerH.value = e.nativeEvent.layout.height; }}>
      <View style={s.header}>
        <Text style={s.logo}>Polygrove</Text>
        <Text style={s.tagline}>An educational ecology trading card app</Text>
        <Text style={s.ecoLabel} numberOfLines={2}>{eco ? eco.name : 'Choose your camp'}</Text>
      </View>
      <View style={s.titleWrap}>
        <Text style={s.title}>Field Notes</Text>
        <Text style={s.sub}>
          {cards.length}/{deckSize} Journaled{rows.length !== cards.length ? ` · ${rows.length} shown` : ''}
        </Text>
      </View>
    </View>
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
    <SectionList
      ref={list}
      sections={[{ data: view === 'hex' ? (rows.length ? [combs as unknown as Card[]] : []) : triples }]}
      keyExtractor={(r, i) => (view === 'hex' ? `comb${i}` : r.map(c => c.id).join('|'))}
      // the filter bar sticks only for the tile grid; with the hexes it scrolls
      // away like the header (user, 2026-10-06: "the all all all disappear when
      // you scroll for the hexagons") — the comb is one fixed-height item, so a
      // bar pinned over it only took room
      stickySectionHeadersEnabled={view !== 'hex'}
      onScroll={e => { scrollY.value = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      renderSectionHeader={() => (inline ? null : filterBar)}
      onScrollToIndexFailed={info => {   // a far row: jump close, then land on it
        list.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
        setTimeout(() => scrollToGlow(false), 300);
      }}
      initialNumToRender={8}
      windowSize={7}
      extraData={owned}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      ListEmptyComponent={
        <View style={[s.center, { paddingTop: 40 }]}>
          <Text style={s.msg}>{cards.length === 0 ? 'Nothing journaled here yet — open a pack.' : 'No journaled cards match these filters.'}</Text>
        </View>
      }
      renderItem={({ item }) => (view === 'hex' ? (
        <View>
          {/* TOP TO BOTTOM (user, 2026-11-16): the filters right under "Field Notes", the
              Hexes/List switch with the quiz button to its right, the card, the hexagons. (The
              button and the filters sat under the card from 2026-10-11.) A mastered card's
              button reads Practice. */}
          {filterBar}
          <View style={[s.topRow, { paddingTop: 12 }]}>
            <ViewToggle mode={view} onChange={setView} />
            {shownCard ? <QuizButton card={shownCard} compact style={s.topQuiz} /> : null}
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            {shownKey ? <ShownCard cells={item as unknown as Comb[]} picked={shownKey} onPick={setPicked} /> : null}
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            <Honeycomb cells={item as unknown as Comb[]} glowKey={glow ?? null} picked={shownKey} onPick={setPicked} />
          </View>
        </View>
      ) : (
        <View style={s.row}>
          {item.map(c => <Cell key={c.id} card={c} glow={c.id === glow} onPress={() => toQuiz(c)} />)}
          {item.length < 3 && Array.from({ length: 3 - item.length }).map((_, i) => <View key={`pad${i}`} style={s.cellWrap} />)}
        </View>
      ))}
    />
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <GreenBackdrop />
      {ready && eco && !error ? body : <>{header}{body}</>}
      {/* no tab bar here (user, 2026-10-06): Field Notes is a page off the camp,
          and the ‹ in the top-left takes you back there */}
      <BackChevron label="Back to camp" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

function FilterBtn({ label, value, open, color, count, onPress }: {
  label: string; value?: string; open: boolean; color?: string; count: number; onPress: () => void;
}) {
  // a chosen value tints the button its color (tier for Level, trophic for
  // Role); "All" and the open state stay grey (user, 2026-09-26)
  const tint = value && color ? { borderColor: `${color}80`, backgroundColor: `${color}1f` } : null;
  return (
    <Pressable onPress={onPress} style={[s.filterBtn, (open || value) && s.filterBtnOn, tint]}>
      <View style={s.filterTop}>
        <Text style={s.filterLabel}>{label}</Text>
        <Text style={s.filterCount}>{count}</Text>
      </View>
      <Text style={[s.filterValue, value && color ? { color } : null]} numberOfLines={1}>
        {value ?? 'All'} {open ? '▴' : '▾'}
      </Text>
    </Pressable>
  );
}

function Chip({ label, count, on, color, onPress }: { label: string; count: number; on: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn, on && color ? { borderColor: `${color}80`, backgroundColor: `${color}22` } : null]}>
      <Text style={[s.chipTxt, on && s.chipTxtOn, on && color ? { color } : null]}>
        {label}<Text style={s.chipCount}>  {count}</Text>
      </Text>
    </Pressable>
  );
}

// one grid tile — a miniature of the pack card (user, 2026-09-26): the card
// body, the hexagon photo on the black glow field, the name, then the
// mastery level. Undiscovered = an empty hexagon with a ?. Mastery score is
// 0 for everyone until the quiz lands.
let _glowSeq = 0;
function Cell({ card, onPress, glow = false }: { card: Card; onPress: () => void; glow?: boolean }) {
  const journaled = true;   // only journaled cards are listed (user, 2026-09-26: no ? tiles)
  // the fresh Solar card: gold border + the demo's gold pulse around the tile
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (glow) pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false);
  }, [glow, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#FFD700', shadowOpacity: glow ? 0.55 + 0.45 * pulse.value : 0,
    shadowRadius: 10 + 12 * pulse.value, shadowOffset: { width: 0, height: 0 },
    transform: [{ scale: glow ? 1 + 0.02 * pulse.value : 1 }],
  }));
  const score = scoreOf(card.species_id);
  const t = getTier(score);
  // the whole tile is themed by LEVEL (user, 2026-09-26): hexagon, glow, divider
  const tc = t.border;
  const photo = journaled ? photoFor(card.id, 250) : undefined;
  const [glowId] = useState(() => `fn${++_glowSeq}`);
  return (
    <Animated.View style={[s.cellWrap, glowStyle]}>
    <Pressable onPress={onPress} disabled={!journaled}
      style={[s.cell, !journaled && { opacity: 0.45 }, glow && s.cellGold]}>
      <View style={s.photoWrap}>
        {journaled && (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id={glowId} cx="50%" cy="50%" rx="62%" ry="56%">
                <Stop offset="0" stopColor={tc} stopOpacity={0.21} />
                <Stop offset="0.7" stopColor={tc} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} />
          </Svg>
        )}
        <HexPhoto uri={photo} frame={framingFor(card.id)} width={58} height={66} borderColor={journaled ? tc : '#2a2a2a'} borderWidth={3} />
        {!journaled && <Text style={s.unknown}>?</Text>}
      </View>
      <View style={[s.divider, { backgroundColor: journaled ? t.border : '#262626' }]} />
      <Text style={s.name} numberOfLines={2}>{journaled ? card.name : '???'}</Text>
      <View style={s.foot}>
        <Text style={[s.tier, { color: journaled ? t.border : '#333333' }]} numberOfLines={1}>
          {journaled ? `${t.label} LEVEL` : '???'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {MASTERY.map((m, i) => (
            <View key={m.key} style={[s.dot, { backgroundColor: journaled && i < getLevel(score) ? m.border : '#222222' }]} />
          ))}
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  topQuiz: { flexShrink: 1 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  cellWrap: { flex: 1, marginBottom: 10 },
  cellGold: { borderWidth: 2, borderColor: '#FFD700' },
  photoWrap: { flex: 1, backgroundColor: '#111111', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1.5 },
  name: { fontFamily: F.display, fontSize: 8.5, color: C.text, lineHeight: 11, paddingHorizontal: 6, paddingTop: 5, minHeight: 27 },
  unknown: { position: 'absolute', fontFamily: F.display, fontSize: 20, color: '#3a3a3a' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6, paddingTop: 2, paddingBottom: 5 },
  tier: { fontFamily: F.sansBold, fontSize: 7, textTransform: 'uppercase', flexShrink: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  cell: {
    aspectRatio: 3 / 4, borderRadius: 12, borderWidth: 1,
    borderColor: '#333333', backgroundColor: '#1a1a1a', overflow: 'hidden',
  },
  root: { flex: 1, backgroundColor: GREEN_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { fontFamily: F.sans, fontSize: 13, color: C.dim, textAlign: 'center' },
  retry: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', backgroundColor: 'rgba(76,175,80,0.15)' },
  retryTxt: { fontFamily: F.sansBold, color: C.green, fontSize: 13 },
  // the demo's header, same as home
  header: {
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8, alignItems: 'center',   // the rule sits close under the name (user, 2026-10-07)
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.15)',
  },
  logo: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34, marginBottom: 4 },
  // the tagline sits BETWEEN the wordmark and the ecoregion name (user, 2026-09-29)
  tagline: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginBottom: 4 },   // a little closer to the ecoregion name (user, 2026-09-29)
  ecoLabel: { fontFamily: F.sansBold, fontSize: 15, lineHeight: 17, color: '#8B5035', letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2, maxWidth: 340, textAlign: 'center' },   // lines close together (user, 2026-10-07)   // wraps: the full name always shows
  titleWrap: { alignItems: 'center', paddingTop: 16, marginBottom: 4 },
  title: { fontFamily: F.display, fontSize: 20, color: C.text, marginBottom: 2 },
  sub: { fontFamily: F.sans, fontSize: 12, color: '#555' },
  // filters: three dropdown buttons, the open one's options as chips below
  // sticky: opaque so the cards slide underneath (user, 2026-09-28)
  filters: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: GREEN_BG, overflow: 'hidden' },
  filterRow: { flexDirection: 'row', gap: 8 },
  // under the comb: the shown card's way into its quiz (gold 'Practice' once mastered)
  // yellow button, yellow text (user, 2026-10-06); a touch more orange once mastered
  filterBtn: {
    flex: 1, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterBtnOn: { borderColor: '#555555', backgroundColor: 'rgba(255,255,255,0.08)' },
  starBtn: { flex: 0, width: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 },
  starBtnTxt: { fontSize: 22, lineHeight: 26, color: '#777' },
  filterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterLabel: { fontFamily: F.sansBold, fontSize: 8.5, color: '#666', textTransform: 'uppercase', letterSpacing: 1 },
  filterCount: { fontFamily: F.sansMed, fontSize: 9.5, color: '#777' },
  filterValue: { fontFamily: F.sansMed, fontSize: 12.5, color: C.text, marginTop: 1 },
  chipCount: { fontFamily: F.sans, fontSize: 10.5, color: '#777' },
  chips: { gap: 7, paddingTop: 10, paddingRight: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { borderColor: '#666666', backgroundColor: 'rgba(255,255,255,0.1)' },
  chipTxt: { fontFamily: F.sansMed, fontSize: 12, color: C.dim },
  chipTxtOn: { color: C.text },
  // grid tile — the pack card in miniature
  // the regular card's border (PolygroveCard s.phone: 1px #333) — the level
  // shows only in the footer, the role in the hexagon + divider
});
