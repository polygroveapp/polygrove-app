// QUIZ — entered from the Quiz pill under a card in the gallery (user,
// 2026-09-26). Placeholder until the demo's quiz (6 mastery levels, Solar
// celebration, Sol points) is ported.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../../constants/polygrove';
import { cardById } from '../../lib/catalog';

export default function Quiz() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const card = cardById(String(id));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/deck'));
  return (
    <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Pressable onPress={back} hitSlop={12} style={s.back}><Text style={s.backTxt}>‹ Back</Text></Pressable>
      <View style={s.center}>
        <Text style={s.label}>☀️ SOLAR QUIZ</Text>
        <Text style={s.title}>{card?.name ?? 'Card'}</Text>
        <Text style={s.msg}>The quiz is next up — six levels from Clay to Solar, Sol points for every level cleared.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f0a', paddingHorizontal: 20 },
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backTxt: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: '#666' },
  title: { fontFamily: F.display, fontSize: 24, color: C.text, textAlign: 'center' },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19, maxWidth: 300 },
});
