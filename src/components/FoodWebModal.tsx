// Expanded food web — the app's take on the explorer's fwExpand overlay:
// black full-screen, focal species centered, eaten-by above / eats below,
// photo hexes with names + evidence counts. Tapping a species opens its card.

import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, FoodwebLink, cardByName, photoFor } from '../lib/catalog';
import HexPhoto from './HexPhoto';

export default function FoodWebModal({ card, open, onClose }:
  { card: Card; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const tc = TROPHIC_COLOR[card.trophic] || '#81C784';
  const eatenBy = card.foodweb?.eatenBy || [];
  const eats = card.foodweb?.eats || [];

  return (
    <Modal visible={open} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
        <View style={s.head}>
          <Text style={s.title}>{card.name}</Text>
          <Text style={s.sub}>FOOD WEB</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          {eatenBy.length > 0 && (
            <>
              <Text style={[s.secLabel, { color: '#E57373' }]}>EATEN BY</Text>
              <View style={s.wrap}>{eatenBy.map(l => <Node key={l.name} link={l} onClose={onClose} />)}</View>
            </>
          )}
          <View style={s.focalRow}>
            <View style={s.vline} />
            <View style={{ alignItems: 'center' }}>
              <HexPhoto uri={photoFor(card.id, 250)} width={86} height={97} borderColor={tc} borderWidth={5} />
              <Text style={s.focalName}>{card.name}</Text>
              <Text style={[s.focalTrophic, { color: tc }]}>{card.trophic}</Text>
            </View>
            <View style={s.vline} />
          </View>
          {eats.length > 0 && (
            <>
              <Text style={[s.secLabel, { color: '#81C784' }]}>EATS</Text>
              <View style={s.wrap}>{eats.map(l => <Node key={l.name} link={l} onClose={onClose} />)}</View>
            </>
          )}
          {!eatenBy.length && !eats.length && (
            <Text style={{ color: C.faint, fontFamily: F.sans, textAlign: 'center', marginTop: 30 }}>
              no recorded interactions
            </Text>
          )}
          <Text style={s.credit}>GloBI, evidence-weighted · ×n = records</Text>
        </ScrollView>
        <Pressable onPress={onClose} style={s.closeBtn}>
          <Text style={s.closeTxt}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Node({ link, onClose }: { link: FoodwebLink; onClose: () => void }) {
  const router = useRouter();
  const other = cardByName(link.name);
  const oc = other ? (TROPHIC_COLOR[other.trophic] || '#666') : '#444';
  return (
    <Pressable
      disabled={!other}
      onPress={() => { onClose(); if (other) router.push(`/species/${other.id}`); }}
      style={s.node}>
      <HexPhoto uri={other ? photoFor(other.id, 120) : undefined} width={52} height={58} borderColor={oc} borderWidth={3} />
      <Text style={s.nodeName} numberOfLines={2}>{link.name}</Text>
      <Text style={s.nodeEv}>×{link.evidence}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  head: { alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: F.display, fontSize: 22, color: C.text, textAlign: 'center' },
  sub: { fontFamily: F.sansBold, fontSize: 10, color: '#666', letterSpacing: 2.4, marginTop: 4 },
  secLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, textAlign: 'center', marginVertical: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  node: { alignItems: 'center', width: 84 },
  nodeName: { fontFamily: F.sansMed, fontSize: 10.5, color: C.text, textAlign: 'center', marginTop: 4 },
  nodeEv: { fontFamily: F.sans, fontSize: 9, color: C.faint, marginTop: 1 },
  focalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginVertical: 12 },
  vline: { flex: 1, height: 1, backgroundColor: '#222' },
  focalName: { fontFamily: F.display, fontSize: 13, color: C.text, marginTop: 6, textAlign: 'center' },
  focalTrophic: { fontFamily: F.sansBold, fontSize: 10, marginTop: 2 },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#444', textAlign: 'center', marginTop: 22 },
  closeBtn: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 11, borderRadius: 22,
    backgroundColor: '#222', marginTop: 6,
  },
  closeTxt: { fontFamily: F.sansBold, fontSize: 13.5, color: '#999' },
});
