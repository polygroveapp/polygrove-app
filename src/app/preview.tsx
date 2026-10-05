// A CARD AS IT COULD BE (Sightings; user, 2026-10-05: "click on the waiting
// to be confirmed and potential cards to see the cards as they could be …
// put the missing facts in red"). Not a card you have: a preview of one of
// your sightings as a card.
//  · a species that IS in the game → its real card, wearing your photo and
//    your observation
//  · a species that isn't yet → a card built from whatever the database has
//    for it, with every fact it lacks written in red
// The line above the card says what stands between this and a card of yours.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CloseX from '../components/CloseX';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import PolygroveCard from '../components/PolygroveCard';
import { C, F } from '../constants/polygrove';
import { Card, cardById, loadCatalog } from '../lib/catalog';
import { FACT_LABEL, FactKey, Facts, SightingInfo, loadSightings, useSightings } from '../lib/sightings';
import { openWeb } from '../lib/web';

const ALL: FactKey[] = ['feeding', 'size', 'foodweb', 'slot5', 'biome'];
const listOf = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// the card the database could make today: what it knows, nothing invented
function partialCard(name: string, sci: string, f: Facts | null): Card {
  const edge = f?.edge ?? '';
  const link = (n: string) => [{ name: n, evidence: 1, card: false, inSet: false }];
  return {
    id: `potential:${sci}`, species_id: 0, name, sci, levels: f ? ALL.length - f.missing.length : 0,
    group: f?.group ?? '', trophic: f?.trophic ?? '', size: f?.size ?? null,
    habitat: f?.habitat ?? null, origin: f?.origin ?? null, biome: f?.biome ?? null,
    foodweb: {
      eats: edge.startsWith('eats ') ? link(edge.slice(5)) : [],
      eatenBy: edge.startsWith('eaten by ') ? link(edge.slice(9)) : [],
    },
  };
}

export default function Preview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const { kind, key } = useLocalSearchParams<{ kind?: string; key?: string }>();
  const st = useSightings();
  const [ready, setReady] = useState(false);
  useEffect(() => { Promise.allSettled([loadSightings(), loadCatalog()]).then(() => setReady(true)); }, []);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/sightings'));

  // the sighting, and what is known about its species
  let found: { name: string; sci: string; cardId: string | null; facts: Facts | null; obs: SightingInfo; say: string } | null = null;
  if (kind === 'waiting') {
    const w = st.waiting.find(x => String(x.obsId) === key);
    if (w) {
      const lacking = w.cardId ? [] : (w.facts?.missing ?? ALL);
      found = {
        name: w.name, sci: w.sci, cardId: w.cardId, facts: w.facts, obs: w,
        say: w.cardId ? 'Waiting to be confirmed. Once the iNaturalist community agrees on what it is, this becomes your card.'
          : `Waiting to be confirmed — and the game can’t make this card yet${lacking.length ? `: it’s missing its ${listOf(lacking.map(k => FACT_LABEL[k]))}` : ''}.`,
      };
    }
  } else {
    const p = st.potential.find(x => x.key === key);
    if (p) {
      const lacking = p.cardId ? [] : (p.facts?.missing ?? ALL);
      found = {
        name: p.name, sci: p.sci, cardId: p.cardId, facts: p.facts, obs: { ...p.obs, seen: p.seen },
        say: p.cardId ? `You’ve seen it — it’s ${p.why}.`
          : `You’ve seen it, but the game can’t make this card yet${lacking.length ? `. Missing: ${listOf(lacking.map(k => FACT_LABEL[k]))}` : ''}.`,
      };
    }
  }
  const real = found?.cardId ? cardById(found.cardId) : undefined;
  const card = found ? real ?? partialCard(found.name, found.sci, found.facts) : null;
  const missing = found && !real ? found.facts?.missing ?? ALL : undefined;

  const cardSize = {
    width: Math.min(Math.round(win.width * 0.8), 340),
    height: Math.min(600, win.height - 250 - insets.top - insets.bottom),
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 54, paddingBottom: insets.bottom + 16 }]}>
      <GreenBackdrop />
      <CloseX onPress={close} />
      {!ready ? <ActivityIndicator color={C.green} style={{ marginTop: 80 }} />
        : !found || !card ? <Text style={s.none}>That sighting isn’t in the list any more — check for new sightings.</Text>
        : (
          <>
            <Text style={s.kind}>{real ? 'HOW YOUR CARD WOULD LOOK' : 'AN INCOMPLETE CARD'}</Text>
            <Text style={s.say}>{found.say}</Text>
            <View style={cardSize}>
              <PolygroveCard card={card} sighting={found.obs} missing={missing} />
            </View>
            {found.obs.uri ? (
              <Pressable onPress={() => found && found.obs.uri && openWeb(found.obs.uri)} style={s.btn}>
                <Text style={s.btnTxt}>See the sighting on iNaturalist ›</Text>
              </Pressable>
            ) : null}
          </>
        )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG, alignItems: 'center', paddingHorizontal: 24 },
  none: { fontFamily: F.sans, fontSize: 13, color: '#888', marginTop: 80, textAlign: 'center', lineHeight: 19 },
  kind: { fontFamily: F.sansBold, fontSize: 11, color: '#777', letterSpacing: 1.4, marginBottom: 6 },
  say: { fontFamily: F.sans, fontSize: 13, color: '#cfcabd', textAlign: 'center', lineHeight: 18.5, marginBottom: 14, maxWidth: 340 },
  btn: {
    marginTop: 14, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 22,
    backgroundColor: 'rgba(76,175,80,0.18)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.45)',
  },
  btnTxt: { fontFamily: F.display, fontSize: 12.5, color: C.green },
});
