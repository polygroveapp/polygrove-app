// ABOUT — the ❓ tab: what Polygrove is and where every fact comes from.

import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNav from '../components/BottomNav';
import { C, F } from '../constants/polygrove';

const open = (u: string) => WebBrowser.openBrowserAsync(u);

export default function About() {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 22, paddingBottom: 30 }}>
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
        <Pressable onPress={() => open('https://polygrovedb.pages.dev')}>
          <Text style={s.link}>Explore the full database ›</Text>
        </Pressable>

        <Text style={s.h}>Photos</Text>
        <Text style={s.p}>
          Photos are cropped from openly licensed Wikimedia Commons images. The ⓘ on every card opens the
          original file with its author and license.
        </Text>

        <Text style={s.foot}>content: polygrovedb.pages.dev · GBIF, Wikipedia & 25 open sources</Text>
      </ScrollView>
      <BottomNav active="about" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  logo: { fontFamily: F.display, fontSize: 30, color: C.green, textAlign: 'center' },
  tag: { fontFamily: F.sans, fontSize: 13, color: C.dim, textAlign: 'center', marginTop: 4, marginBottom: 10 },
  h: { fontFamily: F.display, fontSize: 15, color: C.text, marginTop: 22, marginBottom: 6 },
  p: { fontFamily: F.sans, fontSize: 13.5, color: '#bbb', lineHeight: 20 },
  link: { fontFamily: F.sansBold, fontSize: 13.5, color: C.greenSoft, marginTop: 10 },
  foot: { fontFamily: F.sans, fontSize: 10, color: C.faint, textAlign: 'center', marginTop: 34 },
});
