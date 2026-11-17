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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCardSize } from '../lib/cardSize';
import CloseX from '../components/CloseX';
import GreenBackdrop, { GREEN_BG } from '../components/GreenBackdrop';
import PolygroveCard from '../components/PolygroveCard';
import { C, F } from '../constants/polygrove';
import { cardById, getCards, loadCatalog } from '../lib/catalog';
import { ALL_FACTS as ALL, FACT_LABEL, Facts, SightingInfo, loadSightings, partialCard, useSightings } from '../lib/sightings';
import { openWeb } from '../lib/web';

const listOf = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

export default function Preview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { kind, key, name: pName, sci: pSci, date: pDate, uri: pUri } = useLocalSearchParams<{ kind?: string; key?: string; name?: string; sci?: string; date?: string; uri?: string }>();
  const st = useSightings();
  const [ready, setReady] = useState(false);
  useEffect(() => { Promise.allSettled([loadSightings(), loadCatalog()]).then(() => setReady(true)); }, []);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/sightings'));

  // the sighting, and what is known about its species
  let found: { name: string; sci: string; cardId: string | null; facts: Facts | null; obs: SightingInfo; say: string; eid?: number } | null = null;
  if (kind === 'earned') {
    const e = st.earned.find(x => `${x.eid}:${x.speciesId}` === key);
    if (e) found = { name: e.name, sci: cardById(e.cardId)?.sci ?? '', cardId: e.cardId, facts: null, obs: e, eid: e.eid,
      say: e.already ? `Your sighting. This card was already in the ${e.eco} journal${e.seen && e.seen > 1 ? ` — seen there ${e.seen} times` : ''}.`
        : `Your sighting earned this card. It’s in the ${e.eco} journal${e.seen && e.seen > 1 ? ` — seen there ${e.seen} times` : ''}.` };
  } else if (kind === 'waiting') {
    const w = st.waiting.find(x => String(x.obsId) === key);
    if (w) {
      const lacking = w.cardId ? [] : (w.facts?.missing ?? ALL);
      found = {
        name: w.name, sci: w.sci, cardId: w.cardId, facts: w.facts, obs: w,
        say: w.cardId ? 'Waiting to be confirmed. Once the iNaturalist community agrees on what it is, this becomes your card.'
          : `Waiting to be confirmed — and the game can’t make this card yet${lacking.length ? `: it’s missing its ${listOf(lacking.map(k => FACT_LABEL[k]))}` : ''}.`,
      };
    }
  } else if (kind === 'card') {
    // a card you already hold in that ecoregion's journal, reached from its ✕ on the map (user, 2026-10-07)
    const [eidS, sidS] = (key ?? '').split(':'); const eid = +eidS, sid = +sidS;
    const c = getCards().find(x => x.species_id === sid);
    if (c) found = { name: c.name, sci: c.sci, cardId: c.id, facts: null, eid, obs: { obsId: 0, uri: pUri, date: pDate || null },
      say: 'Your sighting. This card is already in your journal here.' };
  } else if (kind === 'obs') {
    // A ✕ FROM THE MAP THAT IS IN NONE OF THE LISTS (user, 2026-10-07: "if it's a
    // green x it should go to the potential card like the grey x") — the lists
    // on the phone are capped, and an unconfirmed sighting can sit outside all of
    // them. It still gets its would-be card, made from what the mark carries;
    // it used to open iNaturalist instead.
    const c = pSci ? getCards().find(x => x.sci.toLowerCase() === pSci.toLowerCase()) : undefined;
    if (pName) found = {
      name: c?.name ?? pName, sci: pSci ?? '', cardId: c?.id ?? null, facts: null,
      obs: { obsId: +(key ?? 0), uri: pUri, date: pDate || null },
      say: c ? 'You’ve seen it. Once the iNaturalist community confirms what it is, this could be your card.'
        : 'You’ve seen it, but the game can’t make this card yet.',
    };
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
  // 'Find card in journal' opens that ecoregion's Field Notes on the card, sliding in from the right (user, 2026-10-06)
  const real = found?.cardId ? cardById(found.cardId) : undefined;
  const card = found ? real ?? partialCard(found.name, found.sci, found.facts) : null;
  const missing = found && !real ? found.facts?.missing ?? ALL : undefined;

  const cardSize = useCardSize();   // the one card size (lib/cardSize)

  return (
    <View style={[s.root, { paddingTop: insets.top + 54, paddingBottom: insets.bottom + 16 }]}>
      <GreenBackdrop />
      <CloseX onPress={close} />
      {!ready ? <ActivityIndicator color={C.green} style={{ marginTop: 80 }} />
        : !found || !card ? <Text style={s.none}>That sighting isn’t in the list any more — check for new sightings.</Text>
        : (
          <>
            <Text style={s.kind}>{kind === 'earned' || kind === 'card' ? 'YOUR SIGHTING' : real ? 'HOW YOUR CARD WOULD LOOK' : 'AN INCOMPLETE CARD'}</Text>
            <Text style={s.say}>{found.say}</Text>
            <View style={cardSize}>
              <PolygroveCard card={card} sighting={found.obs} missing={missing} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* where to go from here (user, 2026-10-07): the journal, when the card is in it there; the
                  database page, for any real card; and the observation itself, quietly */}
              {(kind === 'earned' || kind === 'card') && found.cardId ? (
                <Pressable onPress={() => found && router.push({ pathname: '/deck', params: { glow: found.cardId as string, eid: String(found.eid ?? ''), slide: 'right' } })} style={s.btn}>
                  <Text style={s.btnTxt}>Go to journal ›</Text>
                </Pressable>
              ) : null}
              {real ? (
                <Pressable onPress={() => router.push({ pathname: '/species/[id]', params: { id: real.id } })} style={s.btn}>
                  <Text style={s.btnTxt}>Go to PolygroveDB ›</Text>
                </Pressable>
              ) : null}
              {found.obs.uri ? (
                <Pressable onPress={() => found && found.obs.uri && openWeb(found.obs.uri)} style={[s.btn, s.btnQuiet]}>
                  <Text style={[s.btnTxt, { color: '#ccc' }]}>On iNaturalist ›</Text>
                </Pressable>
              ) : null}
            </View>
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
  btnQuiet: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: '#333' },
  btnTxt: { fontFamily: F.display, fontSize: 12.5, color: C.green },
});
