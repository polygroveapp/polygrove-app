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
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import HexPhoto from '../components/HexPhoto';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { cardById, framingFor, loadCatalog, photoFor } from '../lib/catalog';
import { Naturalist, searchNaturalists } from '../lib/inatPublic';
import { Earned, chooseMe, forgetMe, loadSightings, niceDate, syncSightings, useSightings, useSightingsRun } from '../lib/sightings';
import { openWeb } from '../lib/web';

const STALE_MS = 10 * 60 * 1000;   // coming back to the tab re-checks after ten minutes
const SHOWN = 40;                  // rows per list before "and N more"

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
  // the three lists FOLD (user, 2026-10-05): your cards start open, the
  // other two closed
  const [open, setOpen] = useState<Record<'cards' | 'waiting' | 'potential', boolean>>({ cards: true, waiting: false, potential: false });
  const toggle = (k: keyof typeof open) => setOpen(o => ({ ...o, [k]: !o[k] }));
  // cards in the order you saw them, oldest first (user, 2026-10-05)
  const earned = [...st.earned].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.at - b.at);

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

  const openCard = (e: Earned) => router.push({ pathname: '/gallery', params: { ids: e.cardId, start: '0', eid: String(e.eid) } });
  // waiting and potential sightings open "as they could be" (user, 2026-10-05)
  const preview = (kind: 'waiting' | 'potential', key: string) => router.push({ pathname: '/preview', params: { kind, key } });
  const me = st.me;

  return (
    <View style={s.root}>
      <GreenBackdrop />
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}>
        <View style={s.head}>
          <Text style={s.title}>Sightings</Text>
          <Text style={s.sub}>what you’ve seen on iNaturalist, as cards</Text>
        </View>

        {!ready ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : !me ? (
          <>
            <View style={s.card}>
              <Text style={s.globe}>🌎</Text>
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

            <View style={s.stats}>
              <Stat n={st.earned.length} label="Cards earned" />
              <Stat n={st.waitingTotal} label="Waiting" />
              <Stat n={st.potentialTotal} label="Potential" />
            </View>

            <Pressable onPress={() => syncSightings()} disabled={run.busy} style={[s.check, run.busy && { opacity: 0.6 }]}>
              {run.busy ? <ActivityIndicator color={C.text} size="small" /> : null}
              <Text style={s.checkTxt}>{run.busy ? run.step ?? 'Checking…' : 'Check for new sightings'}</Text>
            </Pressable>
            {run.err ? <Text style={s.err}>{run.err}</Text> : null}
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

            <Fold label="Cards from your sightings" n={earned.length} open={open.cards} onPress={() => toggle('cards')} />
            {open.cards && (earned.length === 0 ? (
              <Text style={s.empty}>
                {st.checkedAt === 0 ? 'Checking your sightings…' : 'None yet. A confirmed sighting of a species in the game becomes a card here.'}
              </Text>
            ) : earned.slice(0, SHOWN).map(e => <EarnedRow key={`${e.eid}:${e.speciesId}`} e={e} onPress={() => openCard(e)} />))}
            {open.cards && earned.length > SHOWN ? <Text style={s.more}>and {earned.length - SHOWN} more, in their ecoregions’ journals</Text> : null}

            <Fold label="Waiting to be confirmed" n={st.waitingTotal} open={open.waiting} onPress={() => toggle('waiting')} />
            {open.waiting && (st.waiting.length === 0 ? <Text style={s.empty}>Nothing waiting.</Text> : (
              <>
                <Text style={s.hint}>These need the iNaturalist community to agree on what they are. Tap one to see the card it could be.</Text>
                {st.waiting.slice(0, SHOWN).map(w => (
                  <Pressable key={w.obsId} onPress={() => preview('waiting', String(w.obsId))} style={s.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.lineName} numberOfLines={1}>{w.name}</Text>
                      <Text style={s.lineMeta} numberOfLines={1}>{w.cardId ? 'a card once confirmed' : 'not a card yet'}{w.date ? ` · ${niceDate(w.date)}` : ''}</Text>
                    </View>
                    <Text style={s.chev}>›</Text>
                  </Pressable>
                ))}
                {/* the list holds only sightings named down to a species; the rest of the count has not got that far */}
                {st.waiting.length > SHOWN ? <Text style={s.more}>and {st.waiting.length - SHOWN} more</Text> : null}
                {st.waitingTotal > st.waiting.length ? (
                  <Text style={s.more}>{st.waitingTotal - st.waiting.length} more aren’t identified down to a species yet</Text>
                ) : null}
              </>
            ))}

            <Fold label="Potential cards" n={st.potentialTotal} open={open.potential} onPress={() => toggle('potential')} />
            {open.potential && (st.potential.length === 0 ? <Text style={s.empty}>Nothing here — everything you’ve had confirmed is a card.</Text> : (
              <>
                <Text style={s.hint}>You’ve seen these, but the game can’t make the card yet. Tap one to see it as it could be, with what’s missing.</Text>
                {st.potential.slice(0, SHOWN).map(p => (
                  <Pressable key={p.key} onPress={() => preview('potential', p.key)} style={s.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.lineName} numberOfLines={1}>{p.name}{p.seen > 1 ? `  ×${p.seen}` : ''}</Text>
                      <Text style={s.lineMeta} numberOfLines={2}><Text style={{ fontStyle: 'italic' }}>{p.sci}</Text> · {p.why}</Text>
                    </View>
                    <Text style={s.chev}>›</Text>
                  </Pressable>
                ))}
                {st.potentialTotal > Math.min(SHOWN, st.potential.length) ? <Text style={s.more}>and {st.potentialTotal - Math.min(SHOWN, st.potential.length)} more</Text> : null}
              </>
            ))}
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

// a list's fold-up header: name, count, and a chevron that turns
function Fold({ label, n, open, onPress }: { label: string; n: number; open: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.fold} hitSlop={6}>
      <Text style={s.section}>{label} · {n.toLocaleString()}</Text>
      <Text style={[s.foldChev, open && { transform: [{ rotate: '90deg' }] }]}>›</Text>
    </Pressable>
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

function EarnedRow({ e, onPress }: { e: Earned; onPress: () => void }) {
  const card = cardById(e.cardId);
  const tc = card ? TROPHIC_COLOR[card.trophic] || C.greenSoft : C.greenSoft;
  return (
    <Pressable onPress={onPress} style={s.person}>
      <HexPhoto uri={e.photo || photoFor(e.cardId, 250)} frame={e.photo ? undefined : framingFor(e.cardId)} width={46} height={52} borderColor={tc} borderWidth={2.5} />
      <View style={{ flex: 1 }}>
        <Text style={s.pName} numberOfLines={1}>{e.name}</Text>
        <Text style={s.pMeta} numberOfLines={1}>Journaled in {e.eco}{e.date ? ` · seen ${niceDate(e.date)}` : ''}</Text>
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
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
  section: { fontFamily: F.sansBold, fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1 },
  fold: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 10,
    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(129,199,132,0.22)',
  },
  foldChev: { fontFamily: F.sansBold, fontSize: 18, color: '#777', lineHeight: 20 },
  hint: { fontFamily: F.sans, fontSize: 11.5, color: '#777', lineHeight: 16.5, marginBottom: 8 },
  empty: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, paddingVertical: 14 },
  more: { fontFamily: F.sans, fontSize: 11.5, color: '#666', textAlign: 'center', paddingVertical: 6 },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, marginBottom: 8,
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a',
  },
  pic: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1c2a1c' },
  pName: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  pMeta: { fontFamily: F.sans, fontSize: 11.5, color: '#888', marginTop: 1 },
  chev: { fontFamily: F.sansBold, fontSize: 18, color: '#555' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, backgroundColor: '#141414', borderWidth: 1, borderColor: '#242424' },
  lineName: { fontFamily: F.sansBold, fontSize: 13, color: C.text },
  lineMeta: { fontFamily: F.sans, fontSize: 11, color: '#888', marginTop: 1, lineHeight: 15 },
  about: { alignItems: 'center', marginTop: 30 },
  aboutTxt: { fontFamily: F.sans, fontSize: 11.5, color: '#666' },
});
