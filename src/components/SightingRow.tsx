// One shared sighting (Social): the observer's photo when they licensed it
// (with their credit), what it is, when and where — and, when the species is
// a card in the deck, the way to BUY it for 10 Sol. Tapping the row opens the
// observation on iNaturalist.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { framingFor, photoFor } from '../lib/catalog';
import { useOwns } from '../lib/collection';
import { useCurrentEco } from '../lib/ecoregions';
import { Sighting } from '../lib/inatPublic';
import { CARD_PRICE, buyCard, cardForSpecies, homeOf } from '../lib/shop';
import { useSol } from '../lib/sol';
import { openWeb } from '../lib/web';
import HexPhoto from './HexPhoto';

export default function SightingRow({ s, showBy = false }: { s: Sighting; showBy?: boolean }) {
  const router = useRouter();
  const balance = useSol();
  const camp = useCurrentEco();                 // moving camp can change which deck a card joins
  const [msg, setMsg] = useState<string | null>(null);
  const card = cardForSpecies(s.sci);
  const home = card && camp !== undefined ? homeOf(card) : null;
  const owned = useOwns(home, card?.species_id);
  const tc = card ? TROPHIC_COLOR[card.trophic] || C.greenSoft : '#333';

  const buy = () => {
    if (!card) return;
    const r = buyCard(card);
    setMsg(r.ok ? (r.inCamp ? `Journaled in ${r.where}` : `Journaled in ${r.where} — camp there to see it`)
      : r.reason === 'sol' ? `You need ${CARD_PRICE} Sol — take a Solar Quiz` : r.reason === 'owned' ? 'Already in your journal' : 'This card has no ecoregion yet');
  };

  return (
    <View style={st.row}>
      <Pressable onPress={() => openWeb(s.uri)} style={st.top}>
        {s.photo ? <Image source={{ uri: s.photo }} style={st.photo} contentFit="cover" transition={150} />
          : card ? <View style={[st.photo, st.center]}><HexPhoto uri={photoFor(card.id, 250)} frame={framingFor(card.id)} width={64} height={72} borderColor={tc} borderWidth={3} /></View>
          : <View style={[st.photo, st.center]}><Text style={{ fontSize: 22 }}>🌿</Text></View>}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.name} numberOfLines={1}>{s.name}</Text>
          {s.sci ? <Text style={st.sci} numberOfLines={1}>{s.sci}</Text> : null}
          <Text style={st.meta} numberOfLines={1}>{[s.date, s.place].filter(Boolean).join(' · ') || 'no date'}</Text>
          {showBy && s.by.login ? (
            <Pressable hitSlop={6} onPress={() => router.push({ pathname: '/naturalist/[login]', params: { login: s.by.login } })}>
              <Text style={st.by} numberOfLines={1}>@{s.by.login}</Text>
            </Pressable>
          ) : null}
          {s.credit ? <Text style={st.credit} numberOfLines={1}>{s.credit}</Text> : null}
        </View>
      </Pressable>
      {card ? (
        <View style={st.buyRow}>
          <Pressable onPress={() => router.push(`/species/${card.id}`)} hitSlop={6}><Text style={st.cardLink}>See the card ›</Text></Pressable>
          {owned ? <View style={st.owned}><Text style={st.ownedTxt}>✓ In your journal</Text></View>
            : <Pressable onPress={buy} style={[st.buy, balance < CARD_PRICE && { opacity: 0.5 }]}><Text style={st.buyTxt}>Buy card · {CARD_PRICE} Sol 🔆</Text></Pressable>}
        </View>
      ) : <Text style={st.none}>not a card in the deck yet</Text>}
      {msg && <Text style={st.msg}>{msg}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  row: { padding: 10, borderRadius: 14, marginBottom: 8, backgroundColor: '#141414', borderWidth: 1, borderColor: '#2a2a2a', gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  photo: { width: 76, height: 76, borderRadius: 10, backgroundColor: '#0f150f' },
  name: { fontFamily: F.sansBold, fontSize: 14, color: C.text },
  sci: { fontFamily: F.sans, fontSize: 11.5, color: '#888', fontStyle: 'italic' },
  meta: { fontFamily: F.sans, fontSize: 11, color: '#666' },
  by: { fontFamily: F.sansBold, fontSize: 11, color: C.greenSoft },
  credit: { fontFamily: F.sans, fontSize: 9, color: '#555' },
  buyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLink: { fontFamily: F.sansBold, fontSize: 11.5, color: '#8B5035' },
  buy: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFC107' },
  buyTxt: { fontFamily: F.display, fontSize: 11.5, color: '#1a1a1a' },
  owned: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  ownedTxt: { fontFamily: F.sansBold, fontSize: 11, color: C.green },
  none: { fontFamily: F.sans, fontSize: 10.5, color: '#555' },
  msg: { fontFamily: F.sansMed, fontSize: 11.5, color: C.gold },
});
