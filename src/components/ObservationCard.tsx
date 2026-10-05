// A CUSTOM CARD (Social, 2026-10-05): one iNaturalist observation as a card —
// the observer's own photo in the hexagon, what they saw, who saw it, when
// and where, and the photo's credit, always shown. It borrows the deck card's
// frame so it reads as a Polygrove card, but its border is CREAM, a colour no
// deck card uses (those are coloured by feeding role): it is not a card from
// the base game and carries none of its facts.

import { StyleSheet, Text, View } from 'react-native';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { C, F } from '../constants/polygrove';
import { CustomCard, bigPhoto } from '../lib/custom';
import HexPhoto from './HexPhoto';

export const CUSTOM_ACCENT = '#f5f0e8';

export default function ObservationCard({ card }: { card: CustomCard }) {
  const when = [card.date, card.place].filter(Boolean).join(' · ');
  return (
    <View style={s.phone}>
      <View style={s.site}>
        <Text style={s.siteGlyph}>⚑</Text>
        <Text style={s.siteMid}>custom card · iNaturalist</Text>
        <Text style={s.siteGlyph}>☆</Text>
      </View>
      <View style={s.hexGlow}>
        <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Defs>
            <RadialGradient id="obsGlow" cx="50%" cy="50%" rx="62%" ry="56%">
              <Stop offset="0" stopColor={CUSTOM_ACCENT} stopOpacity={0.16} />
              <Stop offset="0.7" stopColor={CUSTOM_ACCENT} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#obsGlow)" />
        </Svg>
        <HexPhoto uri={bigPhoto(card.photo)} width={200} height={226} borderColor={CUSTOM_ACCENT} borderWidth={6} />
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={2}>{card.name}</Text>
        {card.sci ? <Text style={s.sci} numberOfLines={1}>{card.sci}</Text> : null}
        <Text style={s.kind}>Custom · Sighting</Text>
        <View style={s.note}>
          <Text style={s.noteK}>✦ Seen by @{card.by.login}</Text>
          <Text style={s.noteTxt}>{when || 'No date or place given'}</Text>
          {card.credit ? <Text style={s.noteSrc}>Photo {card.credit}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  phone: {
    borderRadius: 20, borderWidth: 3, borderColor: '#2a2a2a', backgroundColor: '#141414',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  site: { flexDirection: 'row', alignItems: 'center', paddingTop: 2, paddingBottom: 7 },
  siteGlyph: { color: '#666666', fontSize: 14, fontFamily: F.sans, lineHeight: 17, width: 23, textAlign: 'center' },
  siteMid: { flex: 1, textAlign: 'center', color: '#555555', fontSize: 11, letterSpacing: 1.1, fontFamily: F.sans },
  hexGlow: {
    height: 262, marginHorizontal: -16, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  body: { paddingTop: 12, gap: 2 },
  name: { fontFamily: F.display, fontSize: 17, color: C.text, lineHeight: 22 },
  sci: { color: '#888888', fontSize: 12, fontFamily: F.sans, fontStyle: 'italic' },
  kind: { fontFamily: F.sansBold, fontSize: 11, color: CUSTOM_ACCENT, opacity: 0.75, marginTop: 2, marginBottom: 8 },
  note: {
    borderLeftWidth: 3, borderLeftColor: CUSTOM_ACCENT, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(245,240,232,0.06)',
  },
  noteK: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: F.sansBold, color: CUSTOM_ACCENT },
  noteTxt: { fontSize: 12.5, color: C.text, fontFamily: F.sans, lineHeight: 17, marginTop: 3 },
  noteSrc: { fontSize: 10.5, color: '#777777', fontFamily: F.sans, marginTop: 4, lineHeight: 14 },
});
