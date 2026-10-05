// ONE CUSTOM CARD, full screen (Social, 2026-10-05): the card made from an
// iNaturalist observation, with the way back to the observation itself and to
// the person who saw it.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CloseX from '../../components/CloseX';
import GreenBackdrop, { GREEN_BG } from '../../components/GreenBackdrop';
import ObservationCard from '../../components/ObservationCard';
import { C, F } from '../../constants/polygrove';
import { loadCustom, useCustomCard } from '../../lib/custom';
import { openWeb } from '../../lib/web';

export default function CustomCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => { loadCustom().then(() => setReady(true)); }, []);
  const card = useCustomCard(Number(id));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/social'));

  return (
    <View style={s.root}>
      <GreenBackdrop />
      <CloseX onPress={close} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 28, alignItems: 'center' }}>
        {!ready ? <ActivityIndicator color={C.green} style={{ marginTop: 80 }} />
          : !card ? <Text style={s.none}>That card isn’t in your collection.</Text>
          : (
            <View style={{ width: Math.min(win.width - 48, 340), gap: 14 }}>
              <ObservationCard card={card} />
              <Pressable onPress={() => openWeb(card.uri)} style={s.btn}>
                <Text style={s.btnTxt}>See the observation on iNaturalist ›</Text>
              </Pressable>
              <Pressable onPress={() => router.push({ pathname: '/naturalist/[login]', params: { login: card.by.login } })} style={[s.btn, s.btnQuiet]}>
                <Text style={[s.btnTxt, { color: '#ccc' }]}>More from @{card.by.login}</Text>
              </Pressable>
            </View>
          )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  none: { fontFamily: F.sans, fontSize: 13, color: '#888', marginTop: 80 },
  btn: { paddingVertical: 12, borderRadius: 22, alignItems: 'center', backgroundColor: 'rgba(76,175,80,0.18)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.45)' },
  btnQuiet: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: '#333' },
  btnTxt: { fontFamily: F.display, fontSize: 12.5, color: C.green },
});
