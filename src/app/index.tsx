// HOME — the demo's home screen (App.jsx "home", mock 2026-09-26) with the
// biome label replaced by the ECOREGION you chose on the map: stats row,
// Discovery Pack (24h reset), Solar Pack + Solar Quiz (dormant until the quiz
// milestone), bottom nav. Recent cards REMOVED (user, 2026-09-28) — the
// Journal is where cards live. The tab is called CAMP (user, same day).

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import EcoHero from '../components/EcoHero';
import SolarPicker from '../components/SolarPicker';
import TipCard from '../components/TipCard';
import { C, F } from '../constants/polygrove';
import { loadCatalog } from '../lib/catalog';
import { loadCollection, useCollection } from '../lib/collection';
import { loadDaily, useDiscoveryCountdown } from '../lib/daily';
import { loadCurrentEco, useCurrentEco } from '../lib/ecoregions';
import { countsOf, isFullyLocked, loadMastery, masteryPct, useMastery } from '../lib/mastery';
import { offlineReady, packsReady, topUp } from '../lib/offline';
import { SOLAR_PACK_COST, loadSol, useSol } from '../lib/sol';
import { takePacksPopup } from '../lib/tips';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [picker, setPicker] = useState(false);
  // "How Packs Work": queued by the pack screen when a first pack ends
  const [packsTip, setPacksTip] = useState(() => takePacksPopup());
  const eco = useCurrentEco();
  const owned = useCollection(eco?.eid);
  const daily = useDiscoveryCountdown();
  const solBal = useSol();
  useMastery();   // Mastery % re-renders as quizzes are won
  const solOk = solBal >= SOLAR_PACK_COST;

  // the hub gates on LOCAL stores only — offline launch still reaches the
  // queue and journal. The catalog loads behind it and tops up the queue.
  const fetchCatalog = () =>
    loadCatalog().then(() => topUp()).catch(() => setOffline(true));
  useEffect(() => {
    Promise.all([loadCollection(), loadCurrentEco(), loadDaily(), loadSol(), loadMastery(), offlineReady()])
      .then(() => setReady(true));
    fetchCatalog();
  }, []);
  // a new ecoregion = a new queue to fill
  useEffect(() => { if (eco) topUp(); }, [eco?.eid]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the demo's greenPulse, verbatim (App.jsx keyframes): the GLOW itself
  // blooms — shadow 16px@0.25 → 28px@0.85 with a wide halo — over 1.8s,
  // with a 1.02 scale breath. Only while a pack is waiting to be opened.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (daily.ready) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
        -1, false);
    } else {
      pulse.value = withTiming(0, { duration: 300 });
    }
  }, [pulse, daily.ready]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.02 * pulse.value }],
    shadowColor: '#4CAF50',
    shadowOpacity: 0.25 + 0.6 * pulse.value,
    shadowRadius: 16 + 24 * pulse.value,
    shadowOffset: { width: 0, height: 4 * (1 - pulse.value) },
    elevation: 8 + 8 * pulse.value,
  }));

  const journaledPct = eco && eco.size > 0 ? Math.round((owned.length / eco.size) * 100) : 0;

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0a0f0a', '#1a2e1a', '#0f1a0f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={s.header}>
          <Text style={s.logo}>Polygrove</Text>
          <Text style={s.tagline}>An educational ecology trading card app</Text>
          {/* just the name: no arrow, not tappable (user, 2026-09-29) — the Map tab is the way there */}
          <Text style={s.ecoLabel} numberOfLines={2}>{eco ? eco.name : 'Choose your camp'}</Text>
        </View>

        {!ready ? (
          <ActivityIndicator color={C.green} style={{ marginTop: 60 }} />
        ) : !eco ? (
          /* first launch: no ecoregion yet — the map is the way in */
          <View style={s.body}>
            <View style={s.pickCard}>
              <Text style={s.pickEmoji}>🗺️</Text>
              <Text style={s.pickTitle}>Where do you want to camp?</Text>
              <Text style={s.pickTxt}>
                Pick the ecoregion you’re in on the map. Your daily pack draws from its species,
                and every ecoregion is its own deck to collect.
              </Text>
              <Pressable onPress={() => router.push('/map')} style={s.pickBtn}>
                <Text style={s.pickBtnTxt}>Open the map</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={s.body}>
            {/* stats */}
            <View style={s.stats}>
              <Stat n={journaledPct} pct label="Journaled" />
              <Stat n={owned.length} label="Species" />
              <Stat n={masteryPct(owned.map(o => o.speciesId))} pct label="Mastery" />
            </View>

            {/* discovery pack */}
            <Animated.View style={[pulseStyle, { borderRadius: 16 }]}>
              <Pressable onPress={() => daily.ready && router.push('/pack')} disabled={!daily.ready}>
                <LinearGradient colors={daily.ready ? ['#1B5E20', '#4CAF50'] : ['#2a2a2a', '#333333']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.packBtn}>
                  <Text style={s.tree}>🌲</Text>
                  <Text style={[s.packTxt, !daily.ready && { color: '#777' }]}>Open Discovery Pack</Text>
                  <Text style={s.tree}>🌲</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <Text style={s.hint}>{daily.label}</Text>
            {offline && (
              <Pressable onPress={() => { setOffline(false); fetchCatalog(); }}>
                <Text style={[s.hint, { marginTop: 2 }]}>
                  offline · {packsReady(eco.eid)} pack{packsReady(eco.eid) === 1 ? '' : 's'} in reserve · tap to retry
                </Text>
              </Pressable>
            )}

            {/* solar pack — 100 Sol a pack, outside the daily limit (demo rule) */}
            {solOk ? (
              <Pressable onPress={() => router.push('/pack?solar=1')}>
                <LinearGradient colors={['#FF6F00', '#FFC107', '#FFD54F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[s.solarBtn, { borderColor: '#FFC107' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>☀️</Text>
                    <Text style={[s.solarTxt, { color: '#1a1a1a' }]}>Open Solar Pack</Text>
                  </View>
                  <Text style={[s.solarSol, { color: '#1a1a1a' }]}>{solBal}/{SOLAR_PACK_COST} Sol 🔆</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={[s.solarBtn, s.solarBtnDim]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>☀️</Text>
                  <Text style={s.solarTxt}>Open Solar Pack</Text>
                </View>
                <Text style={s.solarSol}>{solBal}/{SOLAR_PACK_COST} Sol 🔆</Text>
              </View>
            )}
            <Text style={s.hint}>
              {solOk ? 'Open a Solar Pack with ' : 'Take a quiz to earn '}
              <Text style={{ color: C.gold }}>Sol Points 🔆</Text>
            </Text>


            {/* the ecoregion: place on the map · photo · first sentence — order is
                stats → packs → this → journal/quiz (user, 2026-09-28) */}
            <EcoHero eco={eco} />

            {/* journal · solar quiz (a random journaled card that isn't fully mastered) */}
            <View style={s.row2}>
              <Pressable onPress={() => router.push('/deck')} style={s.reviewBtn}>
                <Text style={s.reviewTxt}>📖 Journal</Text>
              </Pressable>
              {/* pops the three-card picker (user, 2026-09-28) */}
              <Pressable disabled={!owned.length} style={[s.quizBtn, !owned.length && { opacity: 0.45 }]}
                onPress={() => setPicker(true)}>
                <LinearGradient colors={['#1B5E20', '#2E7D32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.quizGrad}>
                  <Text style={s.quizTxt}>☀️ Solar Quiz</Text>
                </LinearGradient>
              </Pressable>
            </View>

          </View>
        )}
      </ScrollView>
      <BottomNav active="home" />
      <SolarPicker visible={picker} owned={owned} onClose={() => setPicker(false)} />
      {/* the demo's first-pack popup, word for word; its button starts a quiz
          on a random journaled card that isn't fully mastered */}
      <TipCard visible={packsTip} maxWidth={380}>
        <Text style={s.tipTitle}> 🌲 How Packs Work 🌲</Text>
        <Text style={s.tipBody}>
          In the game you will get one <Text style={{ color: C.green }}>Discovery Pack</Text> to open every day. To get more
          cards you can open Solar Packs with <Text style={{ color: '#FFD700' }}>Sol Points 🔆</Text> which you earn through
          taking Solar Quizzes.{'\n\n'}
          <Text style={{ color: C.text }}>Try a Solar Quiz out for yourself!</Text>
        </Text>
        <Pressable style={s.tipBtnWrap}
          onPress={() => {
            setPacksTip(false);
            const pool = owned.filter(o => !isFullyLocked(countsOf(o.speciesId)));
            const pick = pool[Math.floor(Math.random() * pool.length)];
            if (pick) setTimeout(() => router.push({ pathname: '/quiz/[id]', params: { id: pick.id } }), 280);
          }}>
          <LinearGradient colors={['#FF6F00', '#FFC107', '#FFD54F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tipBtn}>
            <Text style={s.tipBtnTxt}>☀️ Try a Solar Quiz!</Text>
          </LinearGradient>
        </Pressable>
      </TipCard>
    </View>
  );
}

function Stat({ n, pct, label }: { n: number; pct?: boolean; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text style={s.statN}>{n}</Text>
        {pct && <Text style={s.statPct}>%</Text>}
      </View>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d140d' },
  header: {
    padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  logo: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34, marginBottom: 4 },
  // bigger, and the tagline under it is gone (user, 2026-09-28)
  // the tagline sits BETWEEN the wordmark and the ecoregion name (user, 2026-09-29)
  tagline: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginBottom: 8 },
  ecoLabel: { fontFamily: F.sansBold, fontSize: 15, lineHeight: 20, color: '#8B5035', letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2, maxWidth: 340, textAlign: 'center' },   // wraps: the full name always shows
  body: { paddingHorizontal: 20, paddingTop: 12 },   // a little closer to the header line (user, 2026-09-29)
  // stats
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 24 },
  statN: { fontFamily: F.display, fontSize: 32, color: C.green, lineHeight: 38 },
  statPct: { fontFamily: F.display, fontSize: 14, color: C.green, marginTop: 4, marginLeft: 1 },
  statL: { fontFamily: F.sansBold, fontSize: 10, color: '#666', textTransform: 'uppercase', marginTop: 2 },
  // discovery pack
  packBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 18, paddingHorizontal: 20, borderRadius: 16,
  },
  tree: { fontSize: 22 },
  packTxt: { fontFamily: F.display, fontSize: 16, color: C.text },
  hint: { fontFamily: F.sans, fontSize: 10, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  // solar pack — lit gradient when affordable, dim otherwise (demo styles)
  solarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 18, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1,
  },
  solarBtnDim: { backgroundColor: 'rgba(255,111,0,0.2)', borderColor: 'rgba(255,111,0,0.3)' },
  solarTxt: { fontFamily: F.display, fontSize: 16, color: '#666' },
  solarSol: { fontFamily: F.sansBold, fontSize: 14, color: '#666' },
  // review / quiz
  row2: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reviewBtn: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 16, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333',
  },
  reviewTxt: { fontFamily: F.display, fontSize: 13, color: '#aaa' },
  quizBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  quizGrad: { paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  quizTxt: { fontFamily: F.display, fontSize: 13, color: C.text },
  // "How Packs Work" (demo values)
  tipTitle: { fontFamily: F.display, fontSize: 16, color: C.text, marginBottom: 14 },
  tipBody: { fontFamily: F.sans, fontSize: 13, color: '#aaa', lineHeight: 21.5, marginBottom: 20 },
  tipBtnWrap: { borderRadius: 14, overflow: 'hidden', shadowColor: '#FFC107', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  tipBtn: { padding: 13, alignItems: 'center' },
  tipBtnTxt: { fontFamily: F.display, fontSize: 14, color: '#1a1a1a' },
  // first-launch picker
  pickCard: {
    alignItems: 'center', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)',
    backgroundColor: 'rgba(76,175,80,0.08)', marginTop: 20,
  },
  pickEmoji: { fontSize: 40, marginBottom: 8 },
  pickTitle: { fontFamily: F.display, fontSize: 20, color: C.text, marginBottom: 8 },
  pickTxt: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  pickBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24, backgroundColor: '#2E7D32' },
  pickBtnTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
});
