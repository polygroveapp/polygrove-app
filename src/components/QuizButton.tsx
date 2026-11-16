// THE QUIZ BUTTON under a shown card, above the hexagons — the same everywhere
// (user, 2026-10-18: "below the card and above the hexes … anywhere in the app.
// If it can take a solar quiz … say Take Solar Quiz, otherwise say Take Practice
// Quiz … the practice is a book emoji instead of the sun 📖").
//  · Take Solar Quiz ☀️ — a card you have journaled, still climbing the ladder
//  · Take Practice Quiz 📖 — a card you have not journaled, one already mastered,
//    or anywhere the quiz is practice by design (PolygroveDB). Practice earns no
//    Sol and moves no mastery: the quiz page runs it with `practice=1`.
// Solar is GOLD, like the sun and the Solar Pack; practice is GREEN (user, 2026-11-16 —
// they were the other way round).
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { C, F } from '../constants/polygrove';
import { Card } from '../lib/catalog';
import { ownsAnywhere, useOwns } from '../lib/collection';
import { countsOf, isFullyLocked, useMastery } from '../lib/mastery';

export default function QuizButton({ card, practice = false, style }: { card: Card; practice?: boolean; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  useMastery(); useOwns(null, null);   // re-render when progress or the journal changes
  const owned = ownsAnywhere(card.species_id);
  const mastered = isFullyLocked(countsOf(card.species_id));
  const solar = !practice && owned && !mastered;
  const go = () => router.push({ pathname: '/quiz/[id]', params: solar ? { id: card.id } : { id: card.id, practice: '1' } });
  return (
    <Pressable onPress={go} style={[s.btn, style]} accessibilityRole="button">
      <LinearGradient colors={solar ? ['#5a4a12', '#8a6d1a'] : ['#1B5E20', '#2E7D32']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.grad}>
        <Text style={s.txt}>{solar ? 'Take Solar Quiz ☀️' : 'Take Practice Quiz 📖'}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden' },
  grad: { paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  txt: { fontFamily: F.display, fontSize: 13, color: C.text },
});
