// SOCIAL — iNaturalist (user, 2026-09-29: the tab that replaces About, a
// globe; "we need to log in to iNaturalist when we click on the globe").
// Signed out: opening the tab brings up iNaturalist's own sign-in sheet
// straight away (once per visit; after a cancel the button stays). Signed in:
// who you are there, and your observations — the ones that are cards in
// Polygrove's deck are marked. About lives on as a link at the foot.

import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import { C, F } from '../constants/polygrove';
import { Card, getCards, loadCatalog } from '../lib/catalog';
import {
  INAT_REDIRECT, InatObs, inatConfigured, loadInat, myObservations, refreshUser, signIn, signOut, useInatUser,
} from '../lib/inat';
import { openWeb } from '../lib/web';

export default function Social() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useInatUser();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // kept with the account they belong to, so signing out (or in as someone
  // else) can never show the previous person's list
  const [loaded, setLoaded] = useState<{ uid: number; list: InatObs[] } | null>(null);
  const obs = user && loaded?.uid === user.id ? loaded.list : null;
  const [deck, setDeck] = useState<Map<string, Card>>(new Map());
  const asked = useRef(false);

  useEffect(() => {
    loadInat().then(() => setReady(true));
    loadCatalog().then(() => setDeck(new Map(getCards().map(c => [c.sci.toLowerCase(), c])))).catch(() => { /* the deck marks just stay off */ });
  }, []);

  const login = useCallback(async () => {
    setBusy(true); setNote(null);
    const r = await signIn();
    setBusy(false);
    if (!r.ok && r.reason === 'failed') setNote(`Sign-in didn’t finish${r.detail ? `: ${r.detail}` : ''}.`);
  }, []);

  // tapping the globe IS asking to sign in: the sheet opens by itself, once per visit
  useFocusEffect(useCallback(() => {
    if (ready && !user && inatConfigured() && !asked.current) { asked.current = true; login(); }
    return () => { asked.current = false; };
  }, [ready, user, login]));

  const uid = user?.id;
  useEffect(() => {
    if (uid == null) return;
    let live = true;
    refreshUser().catch(() => {});
    myObservations().then(o => { if (live) setLoaded({ uid, list: o }); }).catch(() => { if (live) setLoaded({ uid, list: [] }); });
    return () => { live = false; };
  }, [uid]);

  const inDeck = obs ? obs.filter(o => o.sci && deck.has(o.sci.toLowerCase())).length : 0;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}>
        <View style={s.head}>
          <Text style={s.title}>Social</Text>
          <Text style={s.sub}>your sightings, from iNaturalist</Text>
        </View>

        {!ready ? (
          <ActivityIndicator color={C.green} style={{ marginTop: 50 }} />
        ) : !user ? (
          <View style={s.card}>
            <Text style={s.globe}>🌎</Text>
            <Text style={s.cardTitle}>Connect iNaturalist</Text>
            <Text style={s.cardTxt}>
              Sign in on iNaturalist to see your own observations here. Polygrove never sees your password, and
              nothing about you is sent to us — your phone talks to iNaturalist directly.
            </Text>
            {inatConfigured() ? (
              <Pressable onPress={login} disabled={busy} style={[s.btn, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color={C.text} /> : <Text style={s.btnTxt}>Log in with iNaturalist</Text>}
              </Pressable>
            ) : (
              // until the app is registered with iNaturalist there is nothing to sign in WITH
              <View style={s.setup}>
                <Text style={s.setupH}>Not set up yet</Text>
                <Text style={s.setupTxt}>
                  Polygrove has to be registered with iNaturalist first (inaturalist.org → Account Settings →
                  Applications → New application). Give it this redirect address:
                </Text>
                <Text selectable style={s.mono}>{INAT_REDIRECT}</Text>
                <Text style={s.setupTxt}>then put the Application ID it gives you in app.json, under extra.inat.clientId.</Text>
              </View>
            )}
            {note && <Text style={s.note}>{note}</Text>}
          </View>
        ) : (
          <>
            <View style={s.me}>
              {user.icon ? <Image source={{ uri: user.icon }} style={s.avatar} contentFit="cover" /> : <View style={[s.avatar, s.center]}><Text style={{ fontSize: 24 }}>🌎</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{user.name || user.login}</Text>
                <Text style={s.login} numberOfLines={1}>@{user.login} · iNaturalist</Text>
              </View>
              <Pressable onPress={signOut} hitSlop={10} style={s.out}><Text style={s.outTxt}>Log out</Text></Pressable>
            </View>
            <View style={s.stats}>
              <Stat n={user.observations ?? (obs?.length ?? 0)} label="Observations" />
              <Stat n={inDeck} label="In the deck" />
            </View>

            <Text style={s.section}>Recent observations</Text>
            {obs == null ? <ActivityIndicator color={C.green} style={{ marginTop: 24 }} />
              : obs.length === 0 ? <Text style={s.empty}>No observations yet. Anything you add on iNaturalist shows up here.</Text>
              : obs.map(o => {
                const card = o.sci ? deck.get(o.sci.toLowerCase()) : undefined;
                return (
                  <Pressable key={o.id} onPress={() => openWeb(o.uri)} style={s.row}>
                    {o.photo ? <Image source={{ uri: o.photo }} style={s.thumb} contentFit="cover" transition={150} /> : <View style={[s.thumb, s.center]}><Text>🌿</Text></View>}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.obsName} numberOfLines={1}>{o.name}</Text>
                      {o.sci ? <Text style={s.obsSci} numberOfLines={1}>{o.sci}</Text> : null}
                      <Text style={s.obsMeta} numberOfLines={1}>{[o.date, o.place].filter(Boolean).join(' · ') || 'no date'}</Text>
                    </View>
                    {card && <View style={s.badge}><Text style={s.badgeTxt}>in the deck</Text></View>}
                  </Pressable>
                );
              })}
          </>
        )}

        <Pressable onPress={() => router.push('/about')} hitSlop={8} style={s.about}>
          <Text style={s.aboutTxt}>About Polygrove · sources and photo credits ›</Text>
        </Pressable>
      </ScrollView>
      <BottomNav active="social" />
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statN}>{n.toLocaleString()}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', marginBottom: 22 },
  title: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34 },
  sub: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginTop: 2 },
  card: {
    alignItems: 'center', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)',
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  globe: { fontSize: 42, marginBottom: 8 },
  cardTitle: { fontFamily: F.display, fontSize: 19, color: C.text, marginBottom: 8 },
  cardTxt: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  btn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24, backgroundColor: '#2E7D32', minWidth: 240, alignItems: 'center' },
  btnTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
  note: { fontFamily: F.sans, fontSize: 12, color: '#E57373', textAlign: 'center', marginTop: 12, lineHeight: 17 },
  setup: { alignSelf: 'stretch', padding: 14, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', gap: 8 },
  setupH: { fontFamily: F.sansBold, fontSize: 11, color: C.gold, textTransform: 'uppercase', letterSpacing: 1 },
  setupTxt: { fontFamily: F.sans, fontSize: 12, color: '#aaa', lineHeight: 17 },
  mono: { fontFamily: 'Courier', fontSize: 11.5, color: C.greenSoft },
  me: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1c2a1c', borderWidth: 2, borderColor: 'rgba(129,199,132,0.4)' },
  name: { fontFamily: F.display, fontSize: 17, color: C.text },
  login: { fontFamily: F.sans, fontSize: 12, color: '#888', marginTop: 2 },
  out: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#333' },
  outTxt: { fontFamily: F.sansBold, fontSize: 11.5, color: '#aaa' },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 46, marginBottom: 24 },
  statN: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34 },
  statL: { fontFamily: F.sansBold, fontSize: 10, color: '#666', textTransform: 'uppercase', marginTop: 2 },
  section: { fontFamily: F.sansBold, fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  empty: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, paddingVertical: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, marginBottom: 8,
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a',
  },
  thumb: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#1c2a1c' },
  obsName: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  obsSci: { fontFamily: F.sans, fontSize: 11.5, color: '#888', fontStyle: 'italic' },
  obsMeta: { fontFamily: F.sans, fontSize: 11, color: '#666' },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  badgeTxt: { fontFamily: F.sansBold, fontSize: 9.5, color: C.green, textTransform: 'uppercase', letterSpacing: 0.5 },
  about: { alignItems: 'center', marginTop: 30 },
  aboutTxt: { fontFamily: F.sans, fontSize: 11.5, color: '#666' },
});
