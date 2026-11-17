// One shared sighting (Social): the observer's photo when they licensed it
// (with their credit), what it is, when and where — and the way to BUY it for
// 10 Sol, which makes a CUSTOM CARD of this observation (user, 2026-10-05; it
// used to hand you the species' deck card — no longer: Social has nothing to
// do with the base game's cards). Tapping the row opens the observation on
// iNaturalist; a sighting whose photo is all-rights-reserved cannot be a card.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../constants/polygrove';
import { CARD_PRICE, buyObservation, useCustomCard } from '../lib/custom';
import { Sighting } from '../lib/inatPublic';
import { useSol } from '../lib/sol';
import { openWeb } from '../lib/web';

export default function SightingRow({ s, showBy = false }: { s: Sighting; showBy?: boolean }) {
  const router = useRouter();
  const balance = useSol();
  const mine = useCustomCard(s.id);
  const [msg, setMsg] = useState<string | null>(null);

  const buy = () => {
    const r = buyObservation(s);
    setMsg(r.ok ? 'Added to your cards'
      : r.reason === 'sol' ? `You need ${CARD_PRICE} Sol — take a Solar Quiz`
      : r.reason === 'owned' ? 'Already one of your cards' : 'This photo isn’t shared for reuse');
  };

  return (
    <View style={st.row}>
      <Pressable onPress={() => openWeb(s.uri)} style={st.top}>
        {s.photo ? <Image source={{ uri: s.photo }} style={st.photo} contentFit="cover" transition={150} />
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
      {mine ? (
        <View style={st.buyRow}>
          <Text style={st.none}>a custom card of this sighting</Text>
          <Pressable onPress={() => router.push({ pathname: '/custom/[id]', params: { id: String(mine.id) } })} style={st.owned}>
            <Text style={st.ownedTxt}>✓ Your card ›</Text>
          </Pressable>
        </View>
      ) : s.photo ? (
        <View style={st.buyRow}>
          <Text style={st.none}>makes a custom card of this sighting</Text>
          <Pressable onPress={buy} style={[st.buy, balance < CARD_PRICE && { opacity: 0.5 }]}><Text style={st.buyTxt}>Buy card · {CARD_PRICE} Sol ☀️</Text></Pressable>
        </View>
      ) : <Text style={st.none}>no photo shared for reuse — can’t be a card</Text>}
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
  buyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  buy: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFC107' },
  buyTxt: { fontFamily: F.display, fontSize: 11.5, color: '#1a1a1a' },
  owned: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  ownedTxt: { fontFamily: F.sansBold, fontSize: 11, color: C.green },
  none: { fontFamily: F.sans, fontSize: 10.5, color: '#666', flexShrink: 1 },
  msg: { fontFamily: F.sansMed, fontSize: 11.5, color: C.gold },
});
