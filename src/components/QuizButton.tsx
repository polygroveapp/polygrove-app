// THE QUIZ BUTTON above a shown card (under it until 2026-11-16) — the same everywhere
// (user, 2026-10-18: "below the card and above the hexes … anywhere in the app.
// If it can take a solar quiz … say Take Solar Quiz, otherwise say Take Practice
// Quiz … the practice is a book emoji instead of the sun 📖").
//  · Take Solar Quiz ☀️ — a card you have journaled, still climbing the ladder
//  · Take Practice Quiz 📖 — a card you have not journaled, one already mastered,
//    or anywhere the quiz is practice by design (PolygroveDB). Practice earns no
//    Sol and moves no mastery: the quiz page runs it with `practice=1`.
// (the card's name was in the wording for an hour on 2026-11-16 — "Take Red-tailed Hawk
// Solar Quiz" — and the user took it back out: "change it back to take quiz")
// Solar is GOLD, like the sun and the Solar Pack; practice is GREEN (user, 2026-11-16 —
// they were the other way round).
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { C, F } from '../constants/polygrove';
import { Card } from '../lib/catalog';
import { ownsAnywhere, useOwns } from '../lib/collection';
import { countsOf, isFullyLocked, useMastery } from '../lib/mastery';

// compact: a small pill that sits in a row beside the Hexes/List switch (the Journal, 2026-11-16)
// — its wording drops "Take" so it never ends in "…" on a narrow phone (user, 2026-11-16)
export default function QuizButton({ card, practice = false, compact = false, style }: { card: Card; practice?: boolean; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  useMastery(); useOwns(null, null);   // re-render when progress or the journal changes
  const owned = ownsAnywhere(card.species_id);
  const mastered = isFullyLocked(countsOf(card.species_id));
  const solar = !practice && owned && !mastered;
  const go = () => router.push({ pathname: '/quiz/[id]', params: solar ? { id: card.id } : { id: card.id, practice: '1' } });
  return (
    <Pressable onPress={go} style={[compact ? s.btnCompact : s.btn, style]} accessibilityRole="button">
      <LinearGradient colors={solar ? ['#5a4a12', '#8a6d1a'] : ['#1B5E20', '#2E7D32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={compact ? s.gradCompact : s.grad}>
        <Text style={compact ? s.txtCompact : s.txt} numberOfLines={1}>{compact ? (solar ? 'Solar Quiz ☀️' : 'Practice Quiz 📖') : solar ? 'Take Solar Quiz ☀️' : 'Take Practice Quiz 📖'}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // as wide as a phone's card, never a bar across a desktop window (2026-11-16)
  btn: { alignSelf: 'center', width: '100%', maxWidth: 440, borderRadius: 16, overflow: 'hidden' },
  grad: { paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  btnCompact: { borderRadius: 14, overflow: 'hidden' },
  gradCompact: { paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' },
  txtCompact: { fontFamily: F.display, fontSize: 11, color: C.text, textAlign: 'center' },
  txt: { fontFamily: F.display, fontSize: 13, color: C.text, textAlign: 'center' },
});
