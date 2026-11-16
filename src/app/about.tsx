// ABOUT — what Polygrove is and where every fact comes from. Reached from the
// foot of the Social tab since 2026-09-29 (it used to be the ❓ tab).

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import CloseX from '../components/CloseX';
import { C, F } from '../constants/polygrove';
import { openWeb } from '../lib/web';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';

const open = (u: string) => openWeb(u);

export default function About() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <GreenBackdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 22, paddingBottom: NAV_HEIGHT + insets.bottom + 24 }}>
        <Text style={s.logo}>Polygrove</Text>
        <Text style={s.tag}>every living thing is a card</Text>

        <Text style={s.h}>How it works</Text>
        <Text style={s.p}>
          Pick the ecoregion you’re in on the map. Every day you open a Discovery Pack drawn from that
          ecoregion’s species — swipe right to journal a card, left to release it. Each ecoregion is its
          own deck, so the same species can be collected again somewhere new.
        </Text>

        <Text style={s.h}>Where the facts come from</Text>
        <Text style={s.p}>
          Every card is built by PolygroveDB, an open pipeline over 25 public sources — GBIF for names and
          observations, Wikipedia and Wikimedia Commons for field notes and photos, GloBI for who eats whom,
          trait databases for size and diet, RESOLVE ecoregions for where things live. Tap a fact on any
          card’s back to see its source and how sure we are.
        </Text>
        <Pressable onPress={() => open('https://polygrovedb.pages.dev/?db')}>
          <Text style={s.link}>Explore the full database ›</Text>
        </Pressable>

        <Text style={s.h}>Photos</Text>
        <Text style={s.p}>
          Photos are cropped from openly licensed Wikimedia Commons images. The ⓘ on every card opens the
          original file with its author and license.
        </Text>

        <Text style={s.foot}>content: polygrovedb.pages.dev · GBIF, Wikipedia & 25 open sources</Text>
      </ScrollView>
      {/* About is reached from Social now (2026-09-29), so that is the tab that stays lit */}
      <CloseX onPress={() => (router.canGoBack() ? router.back() : router.replace('/sightings'))} />
      <BottomNav active="sightings" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  logo: { fontFamily: F.display, fontSize: 30, color: C.green, textAlign: 'center' },
  tag: { fontFamily: F.sans, fontSize: 13, color: C.dim, textAlign: 'center', marginTop: 4, marginBottom: 10 },
  h: { fontFamily: F.display, fontSize: 15, color: C.text, marginTop: 22, marginBottom: 6 },
  p: { fontFamily: F.sans, fontSize: 13.5, color: '#bbb', lineHeight: 20 },
  link: { fontFamily: F.sansBold, fontSize: 13.5, color: C.greenSoft, marginTop: 10 },
  foot: { fontFamily: F.sans, fontSize: 10, color: C.faint, textAlign: 'center', marginTop: 34 },
});
