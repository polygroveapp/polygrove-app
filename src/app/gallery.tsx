// CARD GALLERY — the demo's viewSwipeCard / RecentCardGallery (mock
// 2026-09-26): full-screen dark panel, ✕ top-right, "☀️ CARDS" + page dots
// (the current one wide, in the card's accent), and a horizontal carousel of
// the real cards with neighbors peeking at both sides. Drag to move between
// cards, tap a card to flip it. Wider gaps between cards than the demo (user).
// PACK MODE (?pack=1; user, 2026-09-29): where a pack ends — the cards you
// just journaled, "Take Solar Quiz" (on the card in front) or "Journal"
// beneath them, and ✕ top-right back to Camp. Tapping the backdrop does
// nothing here: an accidental tap must not throw the pack away.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CloseX from '../components/CloseX';
import PolygroveCard from '../components/PolygroveCard';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, cardById, getCards, loadCatalog } from '../lib/catalog';
import { countsOf, isFullyLocked, loadMastery, useMastery } from '../lib/mastery';
import { offlineReady } from '../lib/offline';

const GAP = 22;   // space between cards (demo: ~none)

export default function Gallery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  // glow = a card that just went Solar: it arrives with the demo's gold pulse
  // (highlightCard) for a couple of seconds (user, 2026-09-26)
  const { ids, start, glow, pack } = useLocalSearchParams<{ ids?: string; start?: string; glow?: string; pack?: string }>();
  const isPack = pack === '1';
  const [glowing, setGlowing] = useState<string | null>(glow ?? null);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!glow) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0, { duration: 1000 })), -1, false);
    const t = setTimeout(() => { setGlowing(null); }, 2600);
    return () => clearTimeout(t);
  }, [glow, pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: '#FFD700',
    shadowOpacity: 0.7 + 0.3 * pulse.value,
    shadowRadius: 30 + 25 * pulse.value,
    shadowOffset: { width: 0, height: 0 },
  }));
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => {
    if (!ready) Promise.allSettled([offlineReady(), loadCatalog()]).then(() => setReady(true));
    loadMastery();
  }, [ready]);
  useMastery();   // the Quiz/Practice pill follows progress

  const cards: Card[] = ready
    ? String(ids ?? '').split(',').filter(Boolean).map(id => cardById(id)).filter((c): c is Card => !!c)
    : [];
  const [idx, setIdx] = useState(() => Math.max(0, Math.min(Number(start) || 0, 9999)));
  const tx = useSharedValue(0);

  // narrower than the pack's card so the neighbors peek in at both edges
  // like the demo (card 0.8 of the screen, the rest is the two peeks)
  const cardSize = {
    width: Math.min(Math.round(win.width * 0.8), 340),
    height: Math.min(600, win.height - (isPack ? 190 : 150) - insets.top - insets.bottom),
  };
  const step = cardSize.width + GAP;
  const n = cards.length;

  const go = (i: number) => setIdx(Math.max(0, Math.min(n - 1, i)));
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])   // taps still flip the card
    .onChange(e => { tx.value = e.translationX; })
    .onEnd(() => {
      const d = tx.value < -50 ? 1 : tx.value > 50 ? -1 : 0;
      if (d !== 0) runOnJS(go)(idx + d);
      tx.value = withSpring(0, { damping: 18, stiffness: 170 });
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  const close = () => (router.canGoBack() ? router.back() : router.replace(isPack ? '/' : '/deck'));
  const cur = cards[idx];
  const accent = cur ? TROPHIC_COLOR[cur.trophic] || C.greenSoft : C.greenSoft;

  return (
    // the whole backdrop closes: any tap outside the card (the dark area, the
    // gaps, a peeking neighbor) dismisses the gallery (user, 2026-09-26)
    <Pressable onPress={isPack ? undefined : close} style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <CloseX onPress={close} />
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <View style={s.head}>
          <Text style={s.label}>{isPack ? `🌲 Your pack · ${n} journaled` : '☀️ Cards'}</Text>
          <View style={s.dots}>
            {cards.map((c, i) => (
              <Pressable key={c.id} onPress={() => go(i)} hitSlop={4}
                style={[s.dot, i === idx && { width: 16, backgroundColor: TROPHIC_COLOR[c.trophic] || accent }]} />
            ))}
          </View>
        </View>
        {/* the demo's Quiz pill under the card: THE way into the quiz (user,
            2026-09-26). Green = quiz; gold "Practice" once a card is mastered. */}
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ height: cardSize.height, alignItems: 'center' }, dragStyle]}>
            {cards.map((c, i) => {
              const diff = i - idx;
              if (Math.abs(diff) > 2) return null;   // only neighbors are mounted
              return (
                <View key={c.id} pointerEvents={diff === 0 ? 'auto' : 'none'}
                  style={[cardSize, { position: 'absolute', top: 0, transform: [{ translateX: diff * step }] }]}>
                  {glowing === c.id ? (
                    <Animated.View style={[{ flex: 1, borderRadius: 22 }, glowStyle]}><PolygroveCard card={c} /></Animated.View>
                  ) : <PolygroveCard card={c} />}
                </View>
              );
            })}
          </Animated.View>
        </GestureDetector>
        {cur && isPack && (
          <View style={s.packRow}>
            <Pressable onPress={() => router.replace({ pathname: '/quiz/[id]', params: { id: cur.id } })} style={s.packQuiz}>
              <Text style={s.packQuizTxt}>☀️ Take Solar Quiz</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/deck')} style={s.packJournal}>
              <Text style={s.packJournalTxt}>📖 Journal</Text>
            </Pressable>
          </View>
        )}
        {cur && !isPack && (() => {
          const mastered = isFullyLocked(countsOf(cur.species_id));
          return (
            <View style={s.quizRow}>
              <Pressable onPress={() => router.push(`/quiz/${cur.id}`)}
                style={[s.quizBtn, mastered && { backgroundColor: 'rgba(245,166,35,0.15)', borderColor: 'rgba(245,166,35,0.4)' }]}>
                <Text style={[s.quizTxt, mastered && { color: C.gold }]}>{mastered ? 'Practice' : 'Quiz'}</Text>
              </Pressable>
            </View>
          );
        })()}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f0a' },
  // pack mode: the two ways on
  packRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  packQuiz: { flex: 1.4, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFC107' },
  packQuizTxt: { fontFamily: F.display, fontSize: 13.5, color: '#1a1a1a' },
  packJournal: {
    flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333',
  },
  packJournalTxt: { fontFamily: F.display, fontSize: 13, color: '#ccc' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2, marginTop: 40 },
  label: { fontFamily: F.sansBold, fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  // demo: padding 7px 24px, green 15% fill, 40% border, radius 20, 12px bold
  quizRow: { alignItems: 'center', marginTop: 10 },
  quizBtn: {
    paddingVertical: 7, paddingHorizontal: 24, borderRadius: 20,
    backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)',
  },
  quizTxt: { fontFamily: F.sansBold, fontSize: 12, color: C.green },
});
