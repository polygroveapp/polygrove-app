// Pack opening — the DEMO's swipe deck, its motion verbatim (App.jsx
// SwipeCard; user, 2026-09-29: "have it the same as the demo app … just use
// the same code"): every remaining card is stacked, the ones underneath at
// 95%; the top card follows the finger and tilts offset × 0.12°; past 100px
// it flies to ±600px, turns to ±25° and fades, all in 0.3s ease-out, and the
// swipe counts 300ms later while the next card eases up to full size.
// RIGHT journals it, LEFT releases it. Tap flips to the details back.
// THE WHOLE EXPERIENCE is the demo's too (user, same day: "the pack opening
// experience isn't the same"): no header row — the card fills the screen over
// "← Skip · SWIPE · Collect →"; the first pack opens under the "When
// Collecting Field Notes" tip card (shown once more if nothing is touched for
// 10 seconds); and the fifth card sends you straight back to Camp, where the
// first pack is followed by "How Packs Work". Only the app's 3-skip rule stays.
// THE END OF A PACK (user, 2026-09-29) is the app's own: the five cards you
// journaled, in the gallery's swipe view, over "Take Solar Quiz" and "Journal",
// with ✕ back to Camp.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import PolygroveCard from '../components/PolygroveCard';
import TipCard from '../components/TipCard';
import { C, F } from '../constants/polygrove';
import { Card, loadCatalog, photoFor } from '../lib/catalog';
import { addToCollection, owns } from '../lib/collection';
import { discoveryReady, loadDaily, markDiscoveryOpened } from '../lib/daily';
import { fieldNote } from '../lib/dossier';
import { SOLAR_PACK_COST, canAffordSolar, loadSol, spendSol } from '../lib/sol';
import { loadTips, markTip, queuePacksPopup, tipSeen } from '../lib/tips';
import { campSpot, currentEco, ecoMembers, loadCurrentEco } from '../lib/ecoregions';
import { getPinDraw } from '../lib/mapLook';
import { pinRanking } from '../lib/nearby';
import { useCardSize } from '../lib/cardSize';
import { getPin } from '../lib/pin';
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

// AROUND THE PIN (user, 2026-10-08: "if you put a pin down at Lake Tahoe you
// draw cards around Lake Tahoe"): the camp's deck, steered by the records in the 1° cells
// around the pin (the PolygroveDB tab's Campsite ranking).
// BALANCED BY GROUP (user, 2026-11-17: "make the pin change"). Records are not a census:
// birdwatchers log far more than anyone else — 99% of the Great Basin's records are birds —
// so weighting the whole deck by records made packs there about 88% birds when birds are
// 37% of its deck. Now each card is drawn in two steps:
//   1. its GROUP (bird, mammal, tree, insect …) is chosen in proportion to how many cards
//      of that group are still in the pool — the same odds as the plain deck draw;
//   2. within that group, the species recorded near the pin are favoured, by the square
//      root of their records so the commonest few do not own every pack. A species with no
//      record near the pin is drawn only when the group's near ones have run out.
// So the pin decides WHICH bird or WHICH plant, never how many birds.
async function drawNear(eid: number, lng: number, lat: number, n: number, exclude: Set<number>): Promise<Card[]> {
  const near = new Map(await pinRanking(lng, lat));
  const all = ecoMembers(eid);
  let pool = all.filter(c => !owns(eid, c.species_id) && !exclude.has(c.species_id));
  if (pool.length < n) pool = all.filter(c => !exclude.has(c.species_id));
  const groups = new Map<string, Card[]>();
  for (const c of pool) { const g = c.group || '?'; const l = groups.get(g); if (l) l.push(c); else groups.set(g, [c]); }
  const out: Card[] = [];
  let left = pool.length;
  while (out.length < n && left > 0) {
    // 1 · the group, by its share of what is left
    let r = Math.random() * left;
    let cards: Card[] = [], key = '';
    for (const [g, l] of groups) { cards = l; key = g; if ((r -= l.length) < 0) break; }
    // 2 · the species, by what is recorded near the pin
    const seen = cards.filter(c => (near.get(c.id) ?? 0) > 0);
    let pick: Card;
    if (seen.length) {
      const total = seen.reduce((sum, c) => sum + Math.sqrt(near.get(c.id) as number), 0);
      let w = Math.random() * total, i = 0;
      while (i < seen.length - 1 && (w -= Math.sqrt(near.get(seen[i].id) as number)) > 0) i++;
      pick = seen[i];
    } else {
      pick = cards[Math.floor(Math.random() * cards.length)];
    }
    cards.splice(cards.indexOf(pick), 1);
    if (!cards.length) groups.delete(key);   // an emptied group can no longer be chosen
    left--;
    out.push(pick);
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
  // DAILY DISCOVERY DEALS ONE CARD (user, 2026-11-17: "make it so you … get 1 card at a
  // time"); a Solar Pack is still five. Either way up to SKIPS spares stand behind for passes.
  const need = solar ? PACK_SIZE : 1;
  // …AND IT IS SIMPLY UNLOCKED (user, 2026-11-17: "for the daily you don't get to pass you
  // just unlock the card and press ok"): no swiping and no spares — the card goes into the
  // journal as it is shown. Under it a gold Take Solar Quiz button starts that card's quiz
  // ("put Take Solar Quiz gold button instead of the ok button"), and a small link goes back
  // to Camp. (Leaves burst out for a few hours that day; "and remove animation".)
  const daily = !solar;
  const [okPressed, setOkPressed] = useState(false);
  // every pack pops the queue's front (one code path, photos already on
  // disk); the queue refills its tail in the background
  const [pack, setPack] = useState<Stashed[] | null>(null);
  // the swipe tip, and the demo's first-pack idle reminder (further down): the
  // tip returns once if 10 seconds pass with nothing swiped or touched
  const [tip, setTip] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reminded, setReminded] = useState(false);
  // a tap on "skip" / "journal" swipes the top card for you (user, 2026-09-29)
  const [auto, setAuto] = useState<{ dir: 1 | -1; n: number } | null>(null);
  const [noNet, setNoNet] = useState(false);
  const [eid, setEid] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      await offlineReady();
      const camp = await loadCurrentEco();
      if (!camp) { router.replace('/map'); return; }   // no ecoregion = nothing to draw from
      await Promise.all([loadDaily(), loadSol(), loadTips()]);
      if (solar ? !canAffordSolar() : !discoveryReady()) { router.replace('/'); return; }
      // ALWAYS AROUND THE CAMP'S PIN (user, 2026-11-16: "the pin is where you camp and the
      // species closest to it is what you will see"; a map toggle since 2026-10-08): the
      // camp's deck, weighted by what is recorded around the spot where you camped
      const eco = camp;
      setEid(eco.eid);
      // on unless the map's pin tile switches it off: then it is the ecoregion's deck, evenly (user, 2026-11-17: back "for flexibility")
      const spot = getPinDraw() ? campSpot(camp, getPin()) : null;
      // 5 keeps + up to 3 skip spares. Around the pin is a LIVE draw; with no signal (or no
      // spot) the pack comes from the offline queue, dealt from the camp's deck, as before
      let p: Stashed[] | null = null;
      let near: { lng: number; lat: number } | null = null;
      if (spot) {
        try {
          p = await Promise.race([
            loadCatalog().then(() => drawNear(eco.eid, spot.lng, spot.lat, need, new Set())).then(cs => cs.map(liveStash)),
            new Promise<null>(res => setTimeout(() => res(null), 6000)),   // a weak signal must not hang the pack
          ]);
          if (p && p.length) near = spot; else p = null;
        } catch { p = null; }
      }
      if (!p) { const q = need === PACK_SIZE ? popPack(eco.eid) : popCards(eco.eid, need); p = q && q.length === need ? q : null; }
      if (!p) {
        try {
          await loadCatalog();
          p = drawLive(eco.eid, need, new Set()).map(liveStash);
          topUp();
        } catch { setNoNet(true); return; }
      }
      if (!p.length) { setNoNet(true); return; }
      const spares = daily || near ? [] : popCards(eco.eid, SKIPS);
      if (!daily && spares.length < SKIPS) {
        try {
          await loadCatalog();
          const have = new Set([...p, ...spares].map(st => st.card.species_id));
          spares.push(...(near ? await drawNear(eco.eid, near.lng, near.lat, SKIPS - spares.length, have) : drawLive(eco.eid, SKIPS - spares.length, have)).map(liveStash));
        } catch { /* offline — fewer skips this pack */ }
      }
      // the pack is paid for the moment it's dealt
      if (solar) spendSol(SOLAR_PACK_COST); else markDiscoveryOpened();
      // the demo's cards arrive COMPLETE: warm the first two cards' photo and
      // field note before the deck is shown, so no card appears with an empty
      // hexagon and a "…" note (seen in a frame capture, 2026-09-29). Capped
      // at 1.2s — a slow network shows the deck anyway.
      const first = [...p, ...spares].slice(0, 2);
      await Promise.race([
        Promise.allSettled(first.flatMap(st => {
          const uri = photoFor(st.card.id, 500);
          return [fieldNote(st.card.sci), uri && /^https?:/.test(uri) ? Image.prefetch(uri) : null];
        })),
        new Promise(r => setTimeout(r, 1200)),
      ]);
      setPack([...p, ...spares]);
      if (!daily && !tipSeen('swipe')) setTip(true);   // the demo: if (!swipeTipSeen) setShowSwipeTip(true)
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [idx, setIdx] = useState(0);
  const [kept, setKept] = useState(0);
  useEffect(() => {
    if (daily || !pack || tip || touched || reminded || idx > 0 || kept > 0 || tipSeen('firstPack') || !tipSeen('swipe')) return;
    const t = setTimeout(() => { setTip(true); setReminded(true); }, 10000);
    return () => clearTimeout(t);
  }, [daily, pack, tip, touched, reminded, idx, kept]);
  const [skipped, setSkipped] = useState(0);
  const [swiping, setSwiping] = useState(false);   // a card is mid-flight
  // skips available = spares actually dealt (offline may have fewer)
  const maxSkips = pack ? Math.max(0, pack.length - need) : 0;
  const canSkip = skipped < maxSkips;
  const done = daily ? okPressed : kept >= need;
  // unshown spares go back to the front of the queue
  useEffect(() => {
    if (!daily && done && pack && eid != null && idx < pack.length) returnCards(eid, pack.slice(idx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  // the fifth card goes home (user, 2026-10-08; from 2026-09-29 it opened a
  // "Your Pack" gallery). A first pack still queues "How Packs Work" for the
  // next time Camp comes forward.
  const keptIds = useRef<string[]>([]);
  // the daily card is journaled the moment it is shown
  const unlocked = useRef(false);
  useEffect(() => {
    if (!daily || !pack || !pack.length || unlocked.current) return;
    unlocked.current = true;
    addToCollection(eid ?? currentEco()!.eid, pack[0].card);
    keptIds.current.push(pack[0].card.id);
    snapshotStashed(pack[0]);   // journal = offline forever
  }, [daily, pack, eid]);
  const over = !!pack && (done || idx >= pack.length);
  useEffect(() => {
    if (!over) return;
    if (!tipSeen('firstPack')) { markTip('firstPack'); queuePacksPopup(); }
    // STRAIGHT HOME (user, 2026-10-08: "remove this screen" — the pack's own
    // gallery, "Your Pack · 5 journaled", with Take Solar Quiz / Journal, is gone;
    // the cards are in the journal and the Camp page has both buttons)
    const t = setTimeout(() => router.replace({ pathname: '/', params: { tab: '1' } }), 100);
    return () => clearTimeout(t);
  }, [over, router, daily]);
  // the DEMO's sizing, verbatim (RecentCardGallery: height min(600px,
  // 100dvh-130px), width min(430,screen)*0.88): window-based, no onLayout —
  // measured-flex sizing kept collapsing on the phone (2026-09-25)
  // the demo's swipe stage: the card is at most 340 wide and as tall as the
  // screen allows (its `calc(100vh - 120px)`), hung from the TOP — 16px under
  // the status bar — with the footer directly beneath it
  const cardSize = useCardSize();   // THE card size (lib/cardSize) — this screen's card is where it comes from

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

  if (over) return <View style={s.root} />;   // on its way home

  const onSwiped = (dir: 1 | -1) => {
    if (dir === 1) {
      addToCollection(eid ?? currentEco()!.eid, pack[idx].card);
      keptIds.current.push(pack[idx].card.id);
      snapshotStashed(pack[idx]);   // journal = offline forever
      setKept(k => k + 1);
    } else {
      releaseStashed(pack[idx]);    // skipped → photo file dropped
      setSkipped(n => n + 1);
    }
    setIdx(i => i + 1);
  };
  // the demo: setTimeout(() => onSwipe(d), 300)
  const onFling = (dir: 1 | -1) => { setSwiping(true); setTimeout(() => { onSwiped(dir); setSwiping(false); }, 300); };
  const swipeFor = (dir: 1 | -1) => setAuto(a => ({ dir, n: (a?.n ?? 0) + 1 }));

  return (
    <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 10 }]}>
      {/* the demo's backdrop: the app's dark green gradient, not flat black */}
      <LinearGradient colors={['#0a0f0a', '#1a2e1a', '#0f1a0f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bg} />
      <View style={s.stage} onTouchStart={() => { if (!touched) setTouched(true); }}>
        {/* the demo's deck.map: EVERY remaining card is mounted and stacked
            (keyed, so none remounts when the top one leaves); the last one
            rendered is on top, so the list is reversed */}
        {/* NOTHING BEHIND THE FIFTH (user, 2026-10-07: "when you swipe the fifth card
            to the right make sure there isn't a card behind it"): once four are
            journaled the next one kept ends the pack, so the spare cards waiting
            behind it are not drawn — swiping it away used to flash a card you were
            never going to get. A skip still brings the next spare up as the top card. */}
        {daily ? (
          <View style={s.overlay} pointerEvents="box-none">
            <View style={cardSize}>
              <PolygroveCard card={pack[0].card} demoFrame />
            </View>
          </View>
        ) : (kept >= need - 1 ? pack.slice(idx, idx + 1) : pack.slice(idx)).reverse().map(st => (
          <SwipeSlot key={st.card.id} top={st === pack[idx]} onFling={onFling} canSkip={canSkip} auto={auto}>
            <View style={cardSize}>
              <PolygroveCard card={st.card} demoFrame />
            </View>
          </SwipeSlot>
        ))}
      </View>

      {/* footer (user, 2026-09-29): "Pass" (not skip) · SWIPE · journal k/5 — and the
          two sides are buttons: a tap swipes the top card that way */}
      {daily ? (
        <View style={s.dailyFoot}>
          {/* straight to this card's Solar Quiz; the pack screen is replaced, so the quiz's ‹ goes to Camp */}
          <Pressable accessibilityRole="button" style={s.quizBtn}
            onPress={() => { if (!tipSeen('firstPack')) markTip('firstPack'); router.replace({ pathname: '/quiz/[id]', params: { id: pack[0].card.id } }); }}>
            <LinearGradient colors={['#5a4a12', '#8a6d1a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.quizGrad}>
              <Text style={s.okTxt}>Take Solar Quiz ☀️</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => setOkPressed(true)} hitSlop={10} accessibilityRole="button">
            <Text style={s.backTxt}>Back to Camp</Text>
          </Pressable>
        </View>
      ) : (
      <View style={s.hintRow}>
        <Pressable hitSlop={14} disabled={!canSkip || swiping} onPress={() => swipeFor(-1)}>
          <Text style={[s.hintL, !canSkip && { color: '#3a3a3a' }]}>
            {canSkip ? `◂ Pass · ${maxSkips - skipped} left` : 'no passes left'}
          </Text>
        </Pressable>
        <Text style={s.hintC}>swipe</Text>
        <Pressable hitSlop={14} disabled={swiping} onPress={() => swipeFor(1)}>
          <Text style={s.hintR}>journal {kept}/{need} ▸</Text>
        </Pressable>
      </View>
      )}

      {/* "When Collecting Field Notes" — the demo's swipe tip, word for word */}
      <TipCard visible={tip}>
        <Text style={s.tipTitle}>When Collecting Field Notes</Text>
        <Text style={s.tipSub}>Collect <Text style={s.tipGreen}>{need === 1 ? '1 field note' : `${need} field note`}</Text> {need === 1 ? 'card' : 'cards'} to add to your journal.</Text>
        <View style={s.tipRule} />
        <Text style={s.tipHead}>Swipe Actions</Text>
        <View style={s.tipRow}>
          <View style={[s.tipBox, s.tipBoxSkip]}>
            <Text style={s.tipBoxLabel}>SWIPE LEFT</Text>
            <Text style={s.tipHand}>👈</Text>
            <Text style={[s.tipBoxVerb, { color: '#9E9E9E' }]}>TO PASS</Text>
            <Text style={s.tipBoxTxt}>Not interesting — draws a fresh card</Text>
          </View>
          <View style={[s.tipBox, s.tipBoxKeep]}>
            <Text style={s.tipBoxLabel}>SWIPE RIGHT</Text>
            <Text style={s.tipHand}>👉</Text>
            <Text style={[s.tipBoxVerb, { color: C.green }]}>TO COLLECT</Text>
            <Text style={s.tipBoxTxt}>Adds to your journal — counts toward 5</Text>
          </View>
        </View>
        <View style={s.tipPill}><Text style={s.tipPillTxt}>Tap card to learn more</Text></View>
        <Pressable onPress={() => { setTip(false); markTip('swipe'); }} style={s.tipBtnWrap}>
          <LinearGradient colors={['#1B5E20', '#2E7D32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tipBtn}>
            <Text style={s.tipBtnTxt}>Ok, let’s go!</Text>
          </LinearGradient>
        </Pressable>
      </TipCard>
    </View>
  );
}

function SwipeSlot({ children, top, onFling, canSkip, auto }: {
  children: React.ReactNode;
  top: boolean;            // the active card (false = waiting underneath)
  onFling: (d: 1 | -1) => void;
  canSkip: boolean;        // skips spent → a left fling just springs back
  auto: { dir: 1 | -1; n: number } | null;   // a footer tap: fly this way (n = which tap)
}) {
  const tx = useSharedValue(0);
  const rot = useSharedValue(0);             // only the fly-off's turn; the drag tilt is tx × 0.12
  const gone = useSharedValue(0);            // 0 → 1 as it leaves
  const scale = useSharedValue(top ? 1 : 0.95);
  // the demo's `transition: all 0.3s ease` on scale(active ? 1 : 0.95)
  useEffect(() => {
    scale.value = withTiming(top ? 1 : 0.95, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
  }, [top, scale]);

  const pan = Gesture.Pan()
    .enabled(top)
    .activeOffsetX([-12, 12])   // let taps through to the card flip
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      if (Math.abs(tx.value) > 100 && (tx.value > 0 || canSkip)) {
        const d = tx.value > 0 ? 1 : -1;
        // the demo's gone state: translateX(±600px) rotate(±25deg), opacity 0,
        // `all 0.3s ease-out` — started HERE, once (a withTiming born inside
        // useAnimatedStyle restarts every frame and never progresses)
        const out = { duration: 300, easing: Easing.bezier(0, 0, 0.58, 1) };
        rot.value = tx.value * 0.12;
        rot.value = withTiming(d * 25, out);
        tx.value = withTiming(d * 600, out);
        gone.value = withTiming(1, out);
        runOnJS(onFling)(d);
      } else {
        tx.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });   // the demo's 0.3s ease back
      }
    });

  // a footer tap flies the top card exactly as a swipe would; keyed on the
  // tap's number, so a card that becomes top later never replays an old tap
  // (the tap arrives as one number on a shared value — sign = direction — and
  // the flight itself starts on the UI thread, like a swipe's)
  const cmd = useSharedValue(0);
  useEffect(() => {
    if (auto && top) cmd.value = auto.dir * auto.n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto?.n]);
  useAnimatedReaction(() => cmd.value, (v, prev) => {
    if (v === 0 || v === prev) return;
    const d = v > 0 ? 1 : -1, out = { duration: 300, easing: Easing.bezier(0, 0, 0.58, 1) };
    rot.value = withTiming(d * 25, out);
    tx.value = withTiming(d * 600, out);
    gone.value = withTiming(1, out);
    runOnJS(onFling)(d);
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { rotate: `${gone.value > 0 ? rot.value : tx.value * 0.12}deg` },
      { scale: scale.value },
    ],
    opacity: 1 - gone.value,
  }));

  // NOTE: s.overlay carries explicit top/left/right/bottom — absolute children
  // WITHOUT offsets keep their flow position on iOS (user's phone, 2026-09-25)
  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Animated.View style={[s.overlay, style]} pointerEvents={top ? 'auto' : 'none'}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d140d', paddingHorizontal: 22 },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stage: { flex: 1 },
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'flex-start',   // hung from the top, like the demo
  },
  // the demo's footer: 12px #666 · 10px #555 uppercase, 2px tracking · 12px #4CAF50 600
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 4, paddingHorizontal: 20 },
  // the daily card's one button
  dailyFoot: { alignSelf: 'center', width: '100%', maxWidth: 340, marginTop: 12, alignItems: 'center', gap: 10 },
  quizBtn: { alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden' },
  quizGrad: { paddingVertical: 15, alignItems: 'center' },
  backTxt: { fontFamily: F.sansMed, fontSize: 12, color: '#9a9a9a' },
  okTxt: { fontFamily: F.display, fontSize: 16, color: C.text },
  hintL: { fontFamily: F.sansMed, fontSize: 12, color: C.text },   // Pass in WHITE (user, 2026-09-29)
  hintC: { fontFamily: F.sansBold, fontSize: 10, color: '#8B5035', textTransform: 'uppercase', letterSpacing: 2, marginTop: 3 },   // SWIPE in the header's BROWN (user, 2026-09-29; grey was tried)
  hintR: { fontFamily: F.sansBold, fontSize: 12, color: C.greenSoft },
  // the swipe tip (demo values)
  tipTitle: { fontFamily: F.display, fontSize: 18, color: C.text, textAlign: 'center', marginBottom: 6 },
  tipSub: { fontFamily: F.sans, fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 12, lineHeight: 17 },
  tipGreen: { fontFamily: F.sansBold, color: C.green },
  tipRule: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  tipHead: { fontFamily: F.display, fontSize: 14, color: C.text, textAlign: 'center', marginBottom: 8, marginTop: 4 },
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tipBox: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  tipBoxSkip: { backgroundColor: 'rgba(158,158,158,0.08)', borderColor: 'rgba(158,158,158,0.2)' },
  tipBoxKeep: { backgroundColor: 'rgba(76,175,80,0.08)', borderColor: 'rgba(76,175,80,0.2)' },
  tipBoxLabel: { fontFamily: F.sansBold, fontSize: 10, color: '#9E9E9E', letterSpacing: 1, marginBottom: 6 },
  tipHand: { fontSize: 20, marginBottom: 5 },
  tipBoxVerb: { fontFamily: F.display, fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  tipBoxTxt: { fontFamily: F.sans, fontSize: 9, color: '#666', lineHeight: 12, textAlign: 'center' },
  tipPill: {
    alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tipPillTxt: { fontFamily: F.sans, fontSize: 12, color: '#bbb' },
  tipBtnWrap: { marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  tipBtn: { padding: 13, alignItems: 'center' },
  tipBtnTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
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
