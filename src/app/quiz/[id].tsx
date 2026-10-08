// QUIZ — the demo's Quiz screen (App.jsx Quiz + the answer handler), entered
// from the Quiz pill under a card. One question per Geology tier; a right
// answer bumps that question's count (locks at 2) and moves to the next
// unlocked one; wrong shows "✗ Not quite" + Try Again (re-rolled). Sol: +1 per
// locked non-Solar question, +5 the first time a card goes Solar (with the
// celebration). Once every question is locked the quiz runs as Practice.

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, SharedValue, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import HexPhoto from '../../components/HexPhoto';
import HexThumb from '../../components/HexThumb';
import PolygroveCard from '../../components/PolygroveCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SolarCelebration from '../../components/SolarCelebration';
import { C, F, MASTERY, getLevel, getTier } from '../../constants/polygrove';
import { Card, cardById, framingFor, getCards, loadCatalog, photoFor } from '../../lib/catalog';
import {
  LOCK_THRESHOLD, NUM_Q, countsOf, isFullyLocked, loadMastery, nextUnlocked, recordCorrect, scoreOf, useMastery,
} from '../../lib/mastery';
import { useCurrentEco } from '../../lib/ecoregions';
import { offlineReady } from '../../lib/offline';
import { Q, buildQuiz } from '../../lib/quiz';
import { earnSol } from '../../lib/sol';

export default function Quiz() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => {
    Promise.allSettled([offlineReady(), loadMastery(), loadCatalog()]).then(() => setReady(true));
  }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/deck'));

  if (!ready) return <View style={s.root}><ActivityIndicator color={C.green} style={{ marginTop: 120 }} /></View>;
  const card = cardById(String(id));
  if (!card) return (
    <View style={[s.root, s.center]}>
      <Text style={s.msg}>Card not found.</Text>
      <Pressable onPress={back}><Text style={s.backTxt}>‹ Back</Text></Pressable>
    </View>
  );
  return <QuizBody card={card} back={back} insets={insets} />;
}

function QuizBody({ card, back, insets }: { card: Card; back: () => void; insets: { top: number; bottom: number } }) {
  const router = useRouter();
  const eco = useCurrentEco();
  useMastery();   // re-render on progress
  const sid = card.species_id;
  const [attempt, setAttempt] = useState(0);
  const qs = useMemo(() => buildQuiz(card, attempt), [card, attempt]);
  const available = qs.map(q => !!q);
  const counts = countsOf(sid);
  // questions the card can't ask count as locked, so they never block the ladder
  const effCounts = counts.map((c, i) => (available[i] ? c : LOCK_THRESHOLD));
  const locked = isFullyLocked(effCounts);
  const [practiceLevel, setPracticeLevel] = useState(0);
  // the demo's quizProgress: a correct answer moves FORWARD from the current
  // level (wrapping to the first unlocked one), a retry snaps back to the first
  // unlocked one — never just "first below the lock", which would re-ask Q1
  // while it sits at 1 of 2
  const [progress, setProgress] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const officialLevel = progress !== null && (effCounts[progress] || 0) < LOCK_THRESHOLD ? progress : nextUnlocked(effCounts, 0);
  const level = locked ? practiceLevel : officialLevel;
  const q = qs[level];
  const score = scoreOf(sid);
  const tier = getTier(score);
  const [result, setResult] = useState<{ right: boolean; sol: number; leveledTo?: string; solar?: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  // the demo's solFlash: "+N Sol 🔆" top-right of the card header, 1.5s
  const [solFlash, setSolFlash] = useState<{ amount: number; id: number } | null>(null);

  const next = () => {
    setResult(null);
    setRound(r => r + 1);
    if (locked) { setPracticeLevel(l => { let n = l; do { n = (n + 1) % NUM_Q; } while (!available[n] && n !== l); return n; }); return; }
    const fresh = countsOf(sid).map((c, i) => (available[i] ? c : LOCK_THRESHOLD));
    const n = nextUnlocked(fresh, level + 1);
    setProgress(n !== -1 ? n : nextUnlocked(fresh, 0));
  };
  // a right answer just moves on (user, 2026-09-26): the option goes green
  // for a beat, then the next question comes up on its own — no button.
  // On the LAST question the wrap back to the start is immediate, with no
  // reveal (user). Solar still gets its celebration first.
  const retry = () => { setResult(null); setAttempt(a => a + 1); setProgress(nextUnlocked(effCounts, 0)); };
  const AUTO_NEXT_MS = 700;
  const isLast = level === NUM_Q - 1 || !available.slice(level + 1).some(Boolean);
  const advance = () => { if (isLast) next(); else setTimeout(next, AUTO_NEXT_MS); };
  const onAnswer = (right: boolean) => {
    // a wrong pick on "Is this your card?" never shows the red border or the
    // reveal — it just restarts the ladder (user, 2026-09-26)
    // (the pick button itself fades to red "Incorrect" for a beat first)
    // For the pick, PickCards runs the shuffle itself (cards drop off the
    // bottom, reorder, rise back) — the parent only re-rolls the seed once
    // they're out of sight; it never remounts the component mid-animation.
    if (!right) { if (q?.type !== 'pick') setResult({ right: false, sol: 0 }); return; }
    if (locked) { if (!isLast) setResult({ right: true, sol: 0 }); advance(); return; }   // practice — no level change
    const adv = recordCorrect(sid, level);
    if (adv.sol > 0) { earnSol(adv.sol); setSolFlash({ amount: adv.sol, id: Date.now() }); }
    const leveledTo = adv.newScore > adv.prevScore ? getTier(adv.newScore).label : undefined;
    if (adv.firstSolar) { setResult({ right: true, sol: adv.sol, leveledTo, solar: true }); setCelebrate(true); return; }
    if (!isLast) setResult({ right: true, sol: adv.sol, leveledTo });
    advance();
  };

  // after Solar: FIELD NOTES with this card's tile scrolled into view and
  // haloed gold (user, 2026-09-28; was the gallery opened on the card)
  const showSolarCard = () => {
    setCelebrate(false);
    router.replace({ pathname: '/deck', params: { glow: card.id } });
  };
  if (celebrate) return <SolarCelebration card={card} sol={5} onDone={showSolarCard} />;

  return (
    <View style={s.root}>
      {/* the demo's green ground + header, same as home (user, 2026-09-26) */}
      <LinearGradient colors={['#0a0f0a', '#1a2e1a', '#0f1a0f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
        <View style={s.header}>
          <Pressable onPress={back} hitSlop={12} style={s.back}><Text style={s.backTxt}>‹ Back</Text></Pressable>
          <Text style={s.logo}>Polygrove</Text>
          <Text style={s.tagline}>An educational ecology trading card app</Text>
          <Text style={s.ecoLabel} numberOfLines={2}>{eco ? eco.name : 'Solar Quiz'}</Text>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>

        {/* header: photo, name, tier chip, six dots (ring on the current level) */}
        <View style={s.head}>
          {/* no hexagon up here (user, 2026-09-26) — just the name and the
              tier; during "Is this your card?" the name is hidden too */}
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{q?.type === 'pick' ? 'Which card is yours?' : card.name}</Text>
            <View style={s.tierRow}>
              <View style={[s.tierChip, { backgroundColor: tier.colors[1] }]}>
                <Text style={[s.tierTxt, { color: tier.key === 'basalt' ? '#ccc' : '#1a1a1a' }]}>{tier.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {MASTERY.map((m, i) => (
                  <View key={m.key} style={[s.dot, {
                    backgroundColor: i < getLevel(score) ? m.colors[1] : '#222',
                    borderColor: i < getLevel(score) ? m.border : '#333',
                  }, i === level && { borderWidth: 2, borderColor: m.border, transform: [{ scale: 1.25 }] }]} />
                ))}
              </View>
            </View>
          </View>
          {locked && <Text style={s.practice}>Practice</Text>}
          {solFlash && <SolFlash key={solFlash.id} amount={solFlash.amount} />}
        </View>

        {/* level tabs: locked = gold, passed = its tier, active = white */}
        <View style={s.tabs}>
          {qs.map((qq, i) => {
            const c = effCounts[i];
            const isLocked = c >= LOCK_THRESHOLD, isPassed = c >= 1 && !isLocked, isActive = i === level;
            const gold = MASTERY[MASTERY.length - 1], t = MASTERY[i];
            let bg = '#111', border = '#1a1a1a', color = '#333';
            if (isLocked) { bg = `${gold.border}26`; border = gold.border; color = gold.border; }
            else if (isPassed) { bg = `${t.border}26`; border = `${t.border}88`; color = t.border; }
            else if (isActive) { bg = 'rgba(255,255,255,0.08)'; border = '#444'; color = C.text; }
            const label = qq?.short ?? ['Taxonomy', 'Guild', 'Size', 'Food web', 'Place', 'Your card'][i];
            return (
              // a gold tab GLOWS, steadily — no pulse (user, 2026-10-08)
              <View key={i} style={[s.tab, { backgroundColor: bg, borderColor: border }, isLocked && s.tabGlow]}>
                <Text style={[s.tabTxt, { color }]} numberOfLines={1}>{label}</Text>
              </View>
            );
          })}
        </View>

        {q ? (
          <Question key={q.type === 'pick' ? `${level}-${round}` : `${level}-${attempt}-${round}`} q={q} card={card} done={result !== null} right={!!result?.right} onAnswer={onAnswer}
            // a wrong pick RESTARTS THE LADDER (user, 2026-10-06: "it didn't bring
            // me back to the beginning"): once the hand has dropped out of sight,
            // the questions re-roll and the level snaps to the first unlocked one
            // — only re-asking the pick when it is the only question left
            onReshuffle={() => { setAttempt(a => a + 1); if (!locked) setProgress(nextUnlocked(effCounts, 0)); }} />
        ) : (
          <Text style={s.msg}>This card has no more questions.</Text>
        )}

        {result && !result.right && (
          <View style={s.wrong}>
            <Text style={s.wrongTitle}>✗ Not quite</Text>
            {/* no answer here either: the question is coming back */}
            <Text style={s.wrongTxt}>{q?.type === 'pick' ? explainFor(q, card) : 'Back to the first question. This one will come round again.'}</Text>
            <Pressable onPress={retry} style={s.retry}><Text style={s.retryTxt}>Try Again</Text></Pressable>
          </View>
        )}
        {/* no congratulations line (user, 2026-09-26): the green option + the
            header's tier chip/dots say it all, then it moves on */}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

// "+N Sol 🔆" — gold, rises and fades over 1.5s (demo keyframe solFlash)
function SolFlash({ amount }: { amount: number }) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withTiming(1, { duration: 1500 }); }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateY: -14 * t.value }],
  }));
  return <Animated.Text style={[s.solFlash, style]}>+{amount} Sol 🔆</Animated.Text>;
}

function explainFor(q: Q, card: Card): string {
  if (q.type === 'pick') return `Your card is the one outlined in green — the ${card.name}'s photo with its own field note.`;
  if (q.type === 'dual') return `The ${card.name} consumes ${q.s1.a} and is consumed by ${q.s2.a}.`;
  if (q.type === 'tf') return q.explain ?? `The statement is ${q.a ? 'true' : 'false'}.`;
  return q.explain ?? `${q.q.replace('?', '')}: ${q.a}`;
}

// Q6 — the capstone swipe: three real cards, anonymized, side by side; drag
// between them, "This is my card" picks the one in front. Names show after.
function PickCards({ q, done, onAnswer, onReshuffle }: { q: Extract<Q, { type: 'pick' }>; done: boolean; onAnswer: (r: boolean) => void; onReshuffle: () => void }) {
  const win = useWindowDimensions();
  const [idx, setIdx] = useState(1);   // always open on the middle card
  const [picked, setPicked] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [wrongTick, setWrongTick] = useState(0);   // resets the button after a shuffle
  // ONE FLUID MOTION (user, 2026-10-06: "make it fluid like you're flipping
  // through cards in one motion"): the hand's position is a fractional index
  // that follows the finger, then springs to the nearest card, carried on by
  // the fling's speed — no snap-back-and-jump
  const n = q.cards.length;
  const pos = useSharedValue(1);
  const start = useSharedValue(1);
  const ty = useSharedValue(0);        // the whole hand of cards, dropping off the bottom
  const cardSize = { width: Math.min(Math.round(win.width * 0.78), 320), height: Math.min(520, Math.round(win.height * 0.56)) };
  const step = cardSize.width + 18;
  const SNAP = { damping: 22, stiffness: 190, mass: 0.7 };
  const go = (i: number) => { const t = Math.max(0, Math.min(n - 1, i)); pos.value = withSpring(t, SNAP); setIdx(t); };
  // a wrong pick (user, 2026-09-26): the three drop off the bottom of the
  // screen together as if into your hands, the order re-rolls while they're
  // out of sight, then they rise back and land on the middle card
  const DROP = win.height;
  const reshuffle = () => {
    setShuffling(true);
    ty.value = withTiming(DROP, { duration: 420, easing: Easing.in(Easing.cubic) }, done => {
      if (done) runOnJS(afterDrop)();
    });
  };
  const afterDrop = () => {
    onReshuffle();          // new seed → new order, while hidden
    pos.value = 1; setIdx(1);
    setPicked(null);
    setWrongTick(t => t + 1);
    ty.value = withDelay(120, withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }, d => {
      if (d) runOnJS(setShuffling)(false);
    }));
  };
  const pan = Gesture.Pan()
    .enabled(!shuffling && !done)
    .activeOffsetX([-8, 8])
    .onStart(() => { start.value = pos.value; })
    .onChange(e => {
      const raw = start.value - e.translationX / step;
      // a soft wall past the first and last card
      pos.value = raw < 0 ? raw * 0.35 : raw > n - 1 ? n - 1 + (raw - (n - 1)) * 0.35 : raw;
    })
    .onEnd(e => {
      const target = Math.max(0, Math.min(n - 1, Math.round(pos.value - (e.velocityX / step) * 0.25)));
      pos.value = withSpring(target, { ...SNAP, velocity: -e.velocityX / step });
      runOnJS(setIdx)(target);
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const cur = q.cards[idx];
  const targetCard = q.cards.find(c => c.key === 'correct')?.card;
  const target = targetCard ? { name: targetCard.name, sci: targetCard.sci } : undefined;
  const verdict = (k: string) => (!done ? null : k === q.a ? '#4CAF50' : k === picked ? '#E53935' : null);
  const pickedCard = q.cards.find(c => c.key === picked);
  const reveal = !pickedCard ? '' : pickedCard.key === 'correct' ? `Yes — the ${pickedCard.card.name}.`
    : pickedCard.key === 'other' ? `That's the ${pickedCard.card.name}.`
    : `That's the ${pickedCard.card.name}'s photo — with the ${pickedCard.noteFrom?.name}'s field note.`;
  return (
    <View>
      {/* no question box (user, 2026-09-26): the header names the card, the
          three cards and the button say the rest */}
      <View style={s.pickDots}>
        {q.cards.map((c, i) => (
          <Pressable key={c.key} onPress={() => go(i)} hitSlop={4}
            style={[s.pickDot, i === idx && { width: 16, backgroundColor: verdict(c.key) ?? '#FFD700' }]} />
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ height: cardSize.height, alignItems: 'center' }, dragStyle]}>
          {q.cards.map((c, i) => {
            const v = verdict(c.key);
            return (
              <Slot key={c.key} i={i} pos={pos} step={step} active={i === idx}
                style={[cardSize, v ? { borderRadius: 22, borderWidth: 3, borderColor: v } : null]}>
                {/* all three claim the card in question's name + scientific name,
                    each with a "?" (user, 2026-09-28; was ??? / · · ·) — the tell
                    is the photo and the field note, never the name */}
                {/* every card wears the CORRECT card's facts; only its photo (with its recording)
                    and its field note come from the species it is built on (user, 2026-10-07) */}
                <PolygroveCard card={targetCard ?? c.card} photoFrom={c.card} noteFrom={c.noteFrom ?? c.card} nameAs={done ? undefined : target} />
              </Slot>
            );
          })}
        </Animated.View>
      </GestureDetector>
      {!done ? (
        <PickButton key={wrongTick} disabled={shuffling}
          onPick={() => { const ok = cur.key === q.a; setPicked(cur.key); onAnswer(ok); if (!ok) setTimeout(reshuffle, 700); return ok; }} />
      ) : (
        <Text style={s.pickReveal}>{reveal}</Text>
      )}
    </View>
  );
}

// one card of the hand, placed by the hand's fractional position
function Slot({ i, pos, step, active, style, children }: { i: number; pos: SharedValue<number>; step: number; active: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const at = useAnimatedStyle(() => ({ transform: [{ translateX: (i - pos.value) * step }] }));
  return <Animated.View pointerEvents={active ? 'auto' : 'none'} style={[{ position: 'absolute', top: 0 }, style, at]}>{children}</Animated.View>;
}

// the gold "This is my card" button: on a wrong pick it fades to red and
// reads "Incorrect" (user, 2026-09-26) while the ladder restarts behind it —
// the cards themselves never get a red border or a reveal
function PickButton({ onPick, disabled }: { onPick: () => boolean; disabled?: boolean }) {
  const [wrong, setWrong] = useState(false);
  const t = useSharedValue(0);
  useEffect(() => { if (wrong) t.value = withTiming(1, { duration: 350 }); }, [wrong, t]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['#FFC107', '#E53935']),
  }));
  return (
    <Pressable disabled={wrong || disabled} onPress={() => { if (!onPick()) setWrong(true); }}>
      <Animated.View style={[s.confirm, style]}>
        <Text style={[s.confirmTxt, { color: wrong ? C.text : '#1a1a1a' }]}>{wrong ? 'Incorrect' : 'This is my card'}</Text>
      </Animated.View>
    </Pressable>
  );
}

// FOOD WEB options carry the species' PHOTO under the name box (user,
// 2026-09-28): three tiles in a row, the box colours like any option, the
// hexagon photo below it. Options that aren't deck cards get an empty hexagon.
const _byName = new Map<string, Card>();
function cardByName(name: string): Card | undefined {
  if (!_byName.size) for (const c of getCards()) _byName.set(c.name, c);
  return _byName.get(name);
}
// ALL OR NONE (user, 2026-10-07: "where is there no photo, I feel like the
// answer always has no photo"): the answer is whatever species the records
// name, a deck card or not, while the decoys were mostly cards — so an empty
// hexagon gave the answer away. A row shows its photos only when every option
// has one. (The catalog now also matches decoys to the answer on this, so most
// rows keep their photos.)
const hasPhoto = (name: string) => { const c = cardByName(name); return !!(c && photoFor(c.id, 250)); };
function FoodWebOption({ name, st, disabled, onPress, photos }: { name: string; st: { bg: string; bc: string; tc: string }; disabled: boolean; onPress: () => void; photos: boolean }) {
  const c = cardByName(name);
  return (
    <Pressable disabled={disabled} onPress={onPress} style={s.fwTile}>
      <View style={[s.opt, s.fwBox, { backgroundColor: st.bg, borderColor: st.bc }]}>
        <Text style={[s.fwTxt, { color: st.tc }]} numberOfLines={3}>{name}</Text>
      </View>
      {photos && (
        <View style={s.fwPhoto}>
          <HexPhoto uri={c ? photoFor(c.id, 250) : undefined} frame={c ? framingFor(c.id) : undefined} width={64} height={72} borderColor={st.bc === '#333' ? '#3a3a3a' : st.bc} borderWidth={3} />
        </View>
      )}
    </Pressable>
  );
}

// one question — mc / tf / dual / pick, with the demo's option-state colors:
// dark → gold selected → green right / red wrong
function Question({ q, card, done, right, onAnswer, onReshuffle }: { q: Q; card: Card; done: boolean; right: boolean; onAnswer: (r: boolean) => void; onReshuffle: () => void }) {
  if (q.type === 'pick') return <PickCards q={q} done={done} onAnswer={onAnswer} onReshuffle={onReshuffle} />;
  return <QuestionBody q={q} card={card} done={done} right={right} onAnswer={onAnswer} />;
}

function QuestionBody({ q, card, done, right, onAnswer }: { q: Exclude<Q, { type: 'pick' }>; card: Card; done: boolean; right: boolean; onAnswer: (r: boolean) => void }) {
  const [sel, setSel] = useState<string | boolean | null>(null);
  const [s1, setS1] = useState<string | null>(null);
  const [s2, setS2] = useState<string | null>(null);
  const hash = card.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);

  const optStyle = (isCorrect: boolean, isSelected: boolean) => {
    let bg = 'rgba(0,0,0,0.4)', bc = '#333', tc = '#ccc';
    // THE ANSWER IS NOT GIVEN AWAY ON A MISS (user, 2026-10-07: "the correct one gets
    // highlighted on a second try after failing a later one"): a miss sends you back
    // down the ladder and the same question comes round again, so the right option
    // turns green only when you got it right; a miss marks your pick red, nothing else
    if (done && right && isCorrect) { bg = 'rgba(76,175,80,0.25)'; bc = '#4CAF50'; tc = '#4CAF50'; }
    else if (done && !right && isSelected && !isCorrect) { bg = 'rgba(229,57,53,0.25)'; bc = '#E53935'; tc = '#E53935'; }
    else if (isSelected) { bg = 'rgba(255,215,0,0.1)'; bc = '#FFD700'; tc = '#FFD700'; }
    return { bg, bc, tc };
  };

  if (q.type === 'dual') {
    const can = !!s1 && !!s2;
    return (
      <View style={{ gap: 14 }}>
        {[{ side: q.s1, sel: s1, set: setS1, color: C.text }, { side: q.s2, sel: s2, set: setS2, color: C.green }].map(({ side, sel: sv, set, color }) => (
          <View key={side.title}>
            <Text style={[s.sideTitle, { color }]}>{side.title}</Text>
            <View style={s.fwRow}>
              {side.opts.map(o => (
                <FoodWebOption key={o} name={o} st={optStyle(o === side.a, sv === o)} disabled={done} onPress={() => set(o)} photos={side.opts.every(hasPhoto)} />
              ))}
            </View>
          </View>
        ))}
        {!done && (
          <Pressable disabled={!can} onPress={() => onAnswer(s1 === q.s1.a && s2 === q.s2.a)}
            style={[s.confirm, { backgroundColor: can ? '#FFC107' : '#222' }]}>
            <Text style={[s.confirmTxt, { color: can ? '#1a1a1a' : '#444' }]}>Confirm</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <>
      <View style={s.qBox}>
        {q.type === 'tf' && <Text style={s.qLabel}>True or False — {q.short}</Text>}
        <Text style={s.qTxt}>{q.type === 'tf' ? `“${q.q}”` : q.q}</Text>
      </View>
      <View style={{ gap: 7 }}>
        {q.type === 'mc' && q.short === 'Food web' ? (
          <View style={s.fwRow}>
            {q.opts.map(o => (
              <FoodWebOption key={o} name={o} st={optStyle(o === q.a, sel === o)} disabled={done} onPress={() => { setSel(o); onAnswer(o === q.a); }} photos={q.opts.every(hasPhoto)} />
            ))}
          </View>
        ) : q.type === 'mc' ? q.opts.map(o => {
          const st = optStyle(o === q.a, sel === o);
          const row = q.rows?.[o];
          return (
            <Pressable key={o} disabled={done} onPress={() => { setSel(o); onAnswer(o === q.a); }}
              style={[s.opt, { backgroundColor: st.bg, borderColor: st.bc }, row && s.sizeOpt]}>
              {row ? (
                <>
                  {/* the size question (user, 2026-10-07): the compared species' picture, the figure and
                      that species' name on the left, and on the right the card back's scale bar — where
                      it sits in the group */}
                  {row.egId ? <HexThumb uri={photoFor(row.egId, 120)} width={40} height={46} borderColor={st.tc} borderWidth={2} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optTxt, { color: st.tc }]}>{o}</Text>
                    {row.eg ? <Text style={[s.sizeEg, { color: st.tc }]} numberOfLines={1}>like a {row.eg}</Text> : null}
                  </View>
                  {row.frac != null ? (
                    <View style={s.sizeTrack}>
                      <View style={[s.sizeFill, { width: `${Math.round(row.frac * 100)}%`, backgroundColor: st.tc }]} />
                      <View style={[s.sizeDot, { left: `${Math.round(row.frac * 100)}%`, backgroundColor: st.tc }]} />
                    </View>
                  ) : null}
                </>
              ) : <Text style={[s.optTxt, { color: st.tc }]}>{o}</Text>}
            </Pressable>
          );
        }) : (hash % 2 === 0 ? [true, false] : [false, true]).map(v => {
          const st = optStyle(v === q.a, sel === v);
          return (
            <Pressable key={String(v)} disabled={done} onPress={() => { setSel(v); onAnswer(v === q.a); }}
              style={[s.opt, s.tfOpt, { backgroundColor: st.bg, borderColor: st.bc }]}>
              <Text style={[s.tfTxt, { color: st.tc }]}>{v ? 'True' : 'False'}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d140d' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', marginTop: 20 },
  // the demo's header
  header: {
    padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  logo: { fontFamily: F.display, fontSize: 28, color: C.green, lineHeight: 34, marginBottom: 4 },
  // the tagline sits BETWEEN the wordmark and the ecoregion name (user, 2026-09-29)
  tagline: { fontFamily: F.sans, fontSize: 12, color: '#888', letterSpacing: 0.5, marginBottom: 4 },   // a little closer to the ecoregion name (user, 2026-09-29)
  ecoLabel: { fontFamily: F.sansBold, fontSize: 15, lineHeight: 20, color: '#8B5035', letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2, maxWidth: 340, textAlign: 'center' },   // wraps: the full name always shows
  back: { position: 'absolute', left: 16, top: 12, paddingVertical: 6, zIndex: 2 },
  backTxt: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  name: { fontFamily: F.display, fontSize: 14, color: C.text },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tierChip: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 1 },
  tierTxt: { fontFamily: F.sansBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  practice: { fontFamily: F.sansBold, fontSize: 11, color: '#F5A623' },
  solFlash: { fontFamily: F.display, fontSize: 14, color: '#FFD700', marginLeft: 8 },
  tabs: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  tabGlow: { shadowColor: '#FFD700', shadowOpacity: 0.85, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  tabTxt: { fontFamily: F.sansBold, fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.4 },
  qBox: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#333' },
  qLabel: { fontFamily: F.sansBold, fontSize: 9, color: C.greenSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  qTxt: { fontFamily: F.sans, fontSize: 15, color: C.text, lineHeight: 21 },
  sideTitle: { fontFamily: F.sansBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  opt: { borderWidth: 2, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14 },
  sizeOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  sizeEg: { fontFamily: F.sans, fontSize: 11.5, lineHeight: 15, opacity: 0.7, marginTop: 1 },
  sizeTrack: { width: '36%', height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' },
  sizeFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, opacity: 0.55 },
  sizeDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, marginLeft: -4.5 },
  optTxt: { fontFamily: F.sans, fontSize: 14, lineHeight: 18 },
  fwRow: { flexDirection: 'row', gap: 8 },
  fwTile: { flex: 1, alignItems: 'center', gap: 6 },
  fwBox: { width: '100%', minHeight: 64, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center' },
  fwTxt: { fontFamily: F.sansBold, fontSize: 11.5, lineHeight: 14, textAlign: 'center' },
  fwPhoto: { width: '100%', alignItems: 'center', paddingVertical: 6, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.35)' },
  tfOpt: { paddingVertical: 16, alignItems: 'center' },
  tfTxt: { fontFamily: F.display, fontSize: 18 },
  confirm: { padding: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFC107', marginTop: 12 },
  pickDots: { flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 10 },
  pickDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  pickReveal: { fontFamily: F.sansBold, fontSize: 13, color: C.text, textAlign: 'center', marginTop: 12 },
  confirmTxt: { fontFamily: F.display, fontSize: 14 },
  wrong: { marginTop: 14, padding: 14, borderRadius: 11, backgroundColor: 'rgba(229,57,53,0.08)', borderWidth: 1, borderColor: 'rgba(229,57,53,0.13)', alignItems: 'center', gap: 8 },
  wrongTitle: { fontFamily: F.display, fontSize: 13, color: C.text },
  wrongTxt: { fontFamily: F.sans, fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 17 },
  retry: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: '#444', marginTop: 4 },
  retryTxt: { fontFamily: F.display, fontSize: 12, color: '#ccc' },
});
