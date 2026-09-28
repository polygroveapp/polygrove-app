// Pack opening, faithful to the demo: cards arrive FACE-UP as a swipe deck.
// Drag rotates the card (offset * 0.12deg, demo SwipeCard); past 100px it flies
// off — RIGHT journals it, LEFT releases it. Tap flips to the details back.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PolygroveCard from '../components/PolygroveCard';
import { C, F } from '../constants/polygrove';
import { Card, loadCatalog, photoFor } from '../lib/catalog';
import { addToCollection, owns } from '../lib/collection';
import { discoveryReady, loadDaily, markDiscoveryOpened } from '../lib/daily';
import { SOLAR_PACK_COST, canAffordSolar, loadSol, spendSol } from '../lib/sol';
import { currentEco, ecoMembers, loadCurrentEco } from '../lib/ecoregions';
import {
  PACK_SIZE, Stashed, offlineReady, popCards, popPack, releaseStashed, returnCards, snapshotStashed, topUp,
} from '../lib/offline';

// a pack always ends with 5 journaled cards; you may skip (swipe left) up to
// 3, each skip dealing a replacement (user, 2026-09-26)
const SKIPS = 3;

// live draw from the ecoregion's deck — the fallback when its queue can't
// serve (a fresh ecoregion before the first top-up lands, or a 20-pack
// offline binge that found signal again)
function drawLive(eid: number, n: number, exclude: Set<number>): Card[] {
  const all = ecoMembers(eid);
  const pool = all.filter(c => !owns(eid, c.species_id) && !exclude.has(c.species_id));
  const src = pool.length >= n ? pool : all.filter(c => !exclude.has(c.species_id));
  const out: Card[] = [];
  const seen = new Set<number>();
  while (out.length < n && seen.size < src.length) {
    const c = src[Math.floor(Math.random() * src.length)];
    if (seen.has(c.species_id)) continue;
    seen.add(c.species_id);
    out.push(c);
  }
  return out;
}

const liveStash = (card: Card): Stashed =>
  ({ card, note: null, globi: [], photoUrl: photoFor(card.id, 500) });

export default function PackOpening() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // ?solar=1 → a Solar Pack: costs Sol, ignores the daily limit
  const solar = useLocalSearchParams<{ solar?: string }>().solar === '1';
  // every pack pops the queue's front (one code path, photos already on
  // disk); the queue refills its tail in the background
  const [pack, setPack] = useState<Stashed[] | null>(null);
  const [noNet, setNoNet] = useState(false);
  const [eid, setEid] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      await offlineReady();
      const eco = await loadCurrentEco();
      if (!eco) { router.replace('/map'); return; }   // no ecoregion = nothing to draw from
      await Promise.all([loadDaily(), loadSol()]);
      if (solar ? !canAffordSolar() : !discoveryReady()) { router.replace('/'); return; }
      setEid(eco.eid);
      // 5 keeps + up to 3 skip spares, queue first, live draw for the rest
      let p = popPack(eco.eid);
      if (!p) {
        try {
          await loadCatalog();
          p = drawLive(eco.eid, PACK_SIZE, new Set()).map(liveStash);
          topUp();
        } catch { setNoNet(true); return; }
      }
      if (!p.length) { setNoNet(true); return; }
      const spares = popCards(eco.eid, SKIPS);
      if (spares.length < SKIPS) {
        try {
          await loadCatalog();
          const have = new Set([...p, ...spares].map(st => st.card.species_id));
          spares.push(...drawLive(eco.eid, SKIPS - spares.length, have).map(liveStash));
        } catch { /* offline — fewer skips this pack */ }
      }
      // the pack is paid for the moment it's dealt
      if (solar) spendSol(SOLAR_PACK_COST); else markDiscoveryOpened();
      setPack([...p, ...spares]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [flinging, setFlinging] = useState(false);
  // skips available = spares actually dealt (offline may have fewer)
  const maxSkips = pack ? Math.max(0, pack.length - PACK_SIZE) : 0;
  const canSkip = skipped < maxSkips;
  const done = kept >= PACK_SIZE;
  // unshown spares go back to the front of the queue
  useEffect(() => {
    if (done && pack && eid != null && idx < pack.length) returnCards(eid, pack.slice(idx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  // the DEMO's sizing, verbatim (RecentCardGallery: height min(600px,
  // 100dvh-130px), width min(430,screen)*0.88): window-based, no onLayout —
  // measured-flex sizing kept collapsing on the phone (2026-09-25)
  const win = useWindowDimensions();
  const cardSize = {
    width: Math.min(win.width - 44, 370),
    height: Math.min(600, win.height - 130 - insets.top - insets.bottom),
  };

  if (noNet) return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.center}>
        <Text style={s.doneTitle}>Out of packs</Text>
        <Text style={[s.doneSub, { textAlign: 'center', lineHeight: 19 }]}>
          You’re offline and the pack reserve is empty.{'\n'}
          Reconnect and packs restock on their own.
        </Text>
        <Pressable onPress={() => router.replace('/')} style={s.primary}>
          <Text style={s.primaryTxt}>Camp</Text>
        </Pressable>
      </View>
    </View>
  );
  if (!pack) return <View style={s.root} />;

  if (done || idx >= pack.length) return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.center}>
        <Text style={s.doneTitle}>Pack complete</Text>
        <Text style={s.doneSub}>{kept} journaled · {skipped} skipped</Text>
        <Pressable onPress={() => router.replace('/deck')} style={s.primary}>
          <Text style={s.primaryTxt}>View Journal</Text>
        </Pressable>
        <Text style={s.doneSub}>{solar ? 'Solar Pack · 100 Sol 🔆' : 'Next Discovery Pack in 24 hours'}</Text>
        <Pressable onPress={() => router.replace('/')} style={s.ghost}>
          <Text style={s.ghostTxt}>Camp</Text>
        </Pressable>
      </View>
    </View>
  );

  const onSwiped = (dir: 1 | -1) => {
    if (dir === 1) {
      addToCollection(eid ?? currentEco()!.eid, pack[idx].card);
      snapshotStashed(pack[idx]);   // journal = offline forever
      setKept(k => k + 1);
    } else {
      releaseStashed(pack[idx]);    // skipped → photo file dropped
      setSkipped(n => n + 1);
    }
    setIdx(i => i + 1);
  };
  // the fling starts the card behind moving forward at once; the swap waits
  // until it has fully arrived, so there is nothing left to snap
  const onFling = (dir: 1 | -1) => {
    setFlinging(true);
    setTimeout(() => { onSwiped(dir); setFlinging(false); }, FORWARD_MS);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 14 }]}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <Text style={s.back}>‹ Camp</Text>
        </Pressable>
        <View style={s.dots}>
          {Array.from({ length: PACK_SIZE }, (_, i) => (
            <View key={i} style={[s.dot, i === kept && s.dotOn, i < kept && s.dotDone]} />
          ))}
        </View>
      </View>

      <View style={s.stage}>
        {/* the top card and the one waiting behind it are ONE keyed list: when
            the top card leaves, the card behind keeps its component (no remount,
            no photo reload flash) and is brought forward from the stack WHILE
            the top card flies off (user, 2026-09-26). Behind renders first so
            it sits underneath. */}
        {pack.slice(idx, idx + 2).reverse().map(st => (
          <SwipeSlot key={st.card.id} top={st === pack[idx]} bringForward={flinging} onFling={onFling} canSkip={canSkip}>
            <View style={cardSize}>
              <PolygroveCard card={st.card} />
            </View>
          </SwipeSlot>
        ))}
      </View>

      <View style={s.hintRow}>
        <Text style={[s.hintL, !canSkip && { color: '#3a3a3a' }]}>
          {canSkip ? `◂ skip · ${maxSkips - skipped} left` : 'no skips left'}
        </Text>
        <Text style={s.hintC}>{kept + 1} of {PACK_SIZE} · tap card for details</Text>
        <Text style={s.hintR}>journal ▸</Text>
      </View>
    </View>
  );
}

// the card behind waits slightly smaller, lower and dimmer, then is brought
// forward slowly while the top card flies off (user, 2026-09-26)
const FORWARD_MS = 520;
const FORWARD_EASE = Easing.out(Easing.cubic);

function SwipeSlot({ children, top, bringForward, onFling, canSkip }: {
  children: React.ReactNode;
  top: boolean;            // the swipeable card (false = waiting behind)
  bringForward: boolean;   // the card above is flying off — come forward now
  onFling: (d: 1 | -1) => void;
  canSkip: boolean;        // skips spent → a left fling just springs back
}) {
  const tx = useSharedValue(0);
  const op = useSharedValue(1);
  const fwd = useSharedValue(top ? 1 : 0);   // 0 = waiting in the stack, 1 = in front
  useEffect(() => {
    if (top || bringForward) fwd.value = withTiming(1, { duration: FORWARD_MS, easing: FORWARD_EASE });
  }, [top, bringForward, fwd]);

  const pan = Gesture.Pan()
    .enabled(top)
    .activeOffsetX([-12, 12])   // let taps through to the card flip
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      if (Math.abs(tx.value) > 100 && (tx.value > 0 || canSkip)) {
        const d = tx.value > 0 ? 1 : -1;
        // start both animations HERE, once — a withTiming born inside
        // useAnimatedStyle restarts every frame and never progresses
        tx.value = withTiming(d * 600, { duration: 300 });
        op.value = withTiming(0, { duration: 300 });
        runOnJS(onFling)(d);
      } else {
        tx.value = withSpring(0, { damping: 16, stiffness: 160 });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: 14 * (1 - fwd.value) },
      { rotate: `${tx.value * 0.12}deg` },   // the demo's drag tilt
      { scale: 0.95 + 0.05 * fwd.value },
    ],
    opacity: op.value * (0.55 + 0.45 * fwd.value),
  }));

  // NOTE: s.overlay carries explicit top/left/right/bottom — absolute children
  // WITHOUT offsets keep their flow position on iOS (user's phone, 2026-09-25)
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[s.overlay, style]} pointerEvents={top ? 'auto' : 'none'}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#333' },
  dotOn: { width: 18, backgroundColor: C.greenSoft },
  dotDone: { backgroundColor: '#2E7D32' },
  stage: { flex: 1 },
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  hintL: { fontFamily: F.sansMed, fontSize: 11.5, color: '#666' },
  hintC: { fontFamily: F.sans, fontSize: 10.5, color: C.faint },
  hintR: { fontFamily: F.sansMed, fontSize: 11.5, color: C.greenSoft },
  doneTitle: { fontFamily: F.display, fontSize: 26, color: C.text },
  doneSub: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginBottom: 14 },
  primary: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 13, borderRadius: 24,
    backgroundColor: '#2E7D32', minWidth: 220, alignItems: 'center',
  },
  primaryTxt: { fontFamily: F.sansBold, fontSize: 14.5, color: C.text },
  ghost: { paddingVertical: 8 },
  ghostTxt: { fontFamily: F.sansMed, fontSize: 13.5, color: C.greenSoft },
});
