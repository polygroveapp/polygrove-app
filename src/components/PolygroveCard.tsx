// Faithful port of the demo's CardDisplay (App.jsx:560): the trading card.
// FRONT — #222 header bar (⚑ · polygrove.io · ☆), hex photo on a radial accent
// glow with a 3px accent strip, name block, ✦ Field Note panel, "Tap for
// details" pill. BACK — small hex + name header, slot boxes, field note,
// Consumes + / Consumed By - pair. Tap anywhere flips (0.5s rotateY).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, photoFor } from '../lib/catalog';
import { fieldNote } from '../lib/dossier';
import HexPhoto from './HexPhoto';

export default function PolygroveCard({ card }: { card: Card }) {
  const accent = TROPHIC_COLOR[card.trophic] || '#81C784';
  const photo = photoFor(card.id, 500);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { let on = true; fieldNote(card.sci).then(n => on && setNote(n)); return () => { on = false; }; }, [card.sci]);

  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const doFlip = () => {
    const to = flipped ? 0 : 1;
    setFlipped(!flipped);
    flip.value = withTiming(to, { duration: 500 });
  };
  // backfaceVisibility alone is unreliable on iOS Fabric during animated
  // rotateY — ALSO hard-switch opacity at the 90° midpoint (card is edge-on
  // there, so the cut is invisible) and swap zIndex so the visible face wins
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
    zIndex: flip.value < 0.5 ? 2 : 1,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value < 0.5 ? 0 : 1,
    zIndex: flip.value < 0.5 ? 1 : 2,
  }));

  const eats = card.foodweb?.eats?.[0]?.name;
  const eatenBy = card.foodweb?.eatenBy?.[0]?.name;
  const isProducer = card.trophic === 'Producer';

  return (
    <Pressable onPress={doFlip} style={{ flex: 1 }}>
      {/* FRONT */}
      <Animated.View style={[s.face, frontStyle]}>
        <View style={s.headerBar}>
          <Text style={s.headerGlyph}>⚑</Text>
          <Text style={s.brand}>polygrove.io</Text>
          <Text style={s.headerGlyph}>☆</Text>
        </View>
        <View style={[s.photoArea, { backgroundColor: `${accent}14` }]}>
          <HexPhoto uri={photo} size={200} borderColor={accent} borderWidth={6} />
          <View style={[s.accentStrip, { backgroundColor: accent }]} />
        </View>
        <View style={[s.nameBlock, { borderTopColor: `${accent}33` }]}>
          <Text style={s.name} numberOfLines={1}>{card.name}</Text>
          <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
          <Text style={s.trophicLine}>
            <Text style={{ color: accent, fontFamily: F.sansBold }}>{card.trophic}</Text>
            <Text style={{ color: C.faint }}> · {card.group}</Text>
          </Text>
        </View>
        <View style={s.noteWrap}>
          <View style={[s.notePanel, { backgroundColor: `${accent}15`, borderLeftColor: accent }]}>
            <Text style={[s.noteLabel, { color: accent }]}>✦ FIELD NOTE</Text>
            <Text style={s.noteTxt} numberOfLines={3}>{note ?? '…'}</Text>
          </View>
          <View style={s.tapPillRow}>
            <View style={s.tapPill}><Text style={s.tapPillTxt}>Tap for details</Text></View>
          </View>
        </View>
      </Animated.View>

      {/* BACK */}
      <Animated.View style={[s.face, backStyle]}>
        <View style={s.backPad}>
          <View style={s.backHead}>
            <HexPhoto uri={photoFor(card.id, 120)} size={52} borderColor={accent} borderWidth={3} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={s.backName} numberOfLines={1}>{card.name}</Text>
              <Text style={s.backSci} numberOfLines={1}>{card.sci}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Slot label="TROPHIC LEVEL" value={card.trophic} valueColor={accent} />
            <Slot label="GROUP" value={card.group} />
          </View>
          <Slot label={String(card.slot5type || 'BIOME').toUpperCase()}
            value={card.slot5 || card.biome || card.habitat || card.origin || '—'} />
          {card.size ? <Slot label="SIZE" value={card.size} /> : null}
          <View style={[s.notePanel, { backgroundColor: `${accent}15`, borderLeftColor: accent, marginTop: 8 }]}>
            <Text style={[s.noteLabel, { color: accent }]}>✦ FIELD NOTE</Text>
            <Text style={s.noteTxt} numberOfLines={4}>{note ?? '…'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <View style={[s.chain, isProducer ? s.chainSolar : { backgroundColor: 'rgba(129,199,132,0.1)', borderColor: 'rgba(129,199,132,0.25)' }]}>
              <Text style={[s.chainLabel, { color: isProducer ? '#1a1a1a' : '#81C784' }]}>Consumes +</Text>
              <Text style={[s.chainVal, isProducer && { color: '#1a1a1a', fontFamily: F.sansBold }]} numberOfLines={1}>
                {isProducer ? 'Photosynthesis' : (eats || 'unrecorded')}
              </Text>
            </View>
            <View style={[s.chain, { backgroundColor: 'rgba(229,115,115,0.1)', borderColor: 'rgba(229,115,115,0.25)' }]}>
              <Text style={[s.chainLabel, { color: '#E57373' }]}>Consumed By −</Text>
              <Text style={s.chainVal} numberOfLines={1}>{eatenBy || 'unrecorded'}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function Slot({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={s.slot}>
      <Text style={s.slotLabel}>{label}</Text>
      <Text style={[s.slotVal, valueColor ? { color: valueColor, fontFamily: F.sansBold } : null]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 3, borderColor: '#333',
    overflow: 'hidden', backfaceVisibility: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  headerBar: {
    backgroundColor: '#222', paddingVertical: 8, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerGlyph: { fontSize: 17, color: '#444' },
  brand: { fontFamily: F.sansMed, fontSize: 9, color: C.faint, letterSpacing: 0.5 },
  photoArea: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  accentStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, opacity: 0.7 },
  nameBlock: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4, borderTopWidth: 1 },
  name: { fontFamily: F.display, fontSize: 18, color: C.text, lineHeight: 24 },
  sci: { fontFamily: F.sans, fontSize: 10, color: C.faint, fontStyle: 'italic', marginTop: 2 },
  trophicLine: { fontSize: 10, marginTop: 3, fontFamily: F.sansMed },
  noteWrap: { paddingHorizontal: 16, paddingTop: 11, paddingBottom: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  notePanel: { borderLeftWidth: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  noteLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  noteTxt: { fontFamily: F.sans, fontSize: 13, color: C.text, lineHeight: 17 },
  tapPillRow: { alignItems: 'center', marginTop: 10 },
  tapPill: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  tapPillTxt: { fontFamily: F.sansMed, fontSize: 10, color: '#666' },
  backPad: { flex: 1, padding: 16 },
  backHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backName: { fontFamily: F.display, fontSize: 16, color: C.text },
  backSci: { fontFamily: F.sans, fontSize: 11, color: '#666', fontStyle: 'italic' },
  slot: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12, borderLeftWidth: 3, borderLeftColor: '#333', marginTop: 8,
  },
  slotLabel: { fontSize: 9, color: '#666', fontFamily: F.sansBold, letterSpacing: 1, marginBottom: 2 },
  slotVal: { fontSize: 13, color: C.text, fontFamily: F.sans, lineHeight: 17 },
  chain: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10 },
  chainSolar: { backgroundColor: '#F5A623', borderColor: 'rgba(0,0,0,0.3)' },
  chainLabel: { fontSize: 8, fontFamily: F.sansBold, letterSpacing: 0.5, marginBottom: 2 },
  chainVal: { fontSize: 11, color: C.text, fontFamily: F.sans },
});
