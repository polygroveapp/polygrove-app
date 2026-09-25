// EXACT port of the PolygroveDB explorer card (index.html speciesCardHTML +
// .phone/.dc-* styles). FRONT: ⚑ polygrove.io ☆ text row, 148x167 hex photo,
// 2px accent divider, name/sci/trophic·group, ✦ Field note, "Tap for details".
// BACK: dc-head (46x52 hex + name/sci + ☆), 2x2 centered slot boxes, field
// note, FOOD WEB divider + mini web, "Tap card to flip". Tap flips (0.55s).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Line, Svg } from 'react-native-svg';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, cardByName, photoFor } from '../lib/catalog';
import { fieldNote } from '../lib/dossier';
import FoodWebModal from './FoodWebModal';
import HexPhoto from './HexPhoto';

export default function PolygroveCard({ card }: { card: Card }) {
  const tc = TROPHIC_COLOR[card.trophic] || '#81C784';
  const photo = photoFor(card.id, 500);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { let on = true; fieldNote(card.sci).then(n => on && setNote(n)); return () => { on = false; }; }, [card.sci]);

  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [fwOpen, setFwOpen] = useState(false);
  const doFlip = () => {
    const to = flipped ? 0 : 1;
    setFlipped(!flipped);
    flip.value = withTiming(to, { duration: 550 });   // .flipcard transition .55s
  };
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
    zIndex: flip.value < 0.5 ? 2 : 1,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value < 0.5 ? 0 : 1,
    zIndex: flip.value < 0.5 ? 1 : 2,
  }));

  const slot5label = card.habitat ? 'Habitat' : card.origin ? 'Native origin' : 'Biome';
  const slot5val = card.habitat || card.origin || card.biome || '—';

  return (
    <Pressable onPress={doFlip} style={{ flex: 1 }}>
      {/* FRONT — .face.front */}
      <Animated.View style={[s.phone, frontStyle]}>
        <View style={s.site}>
          <Text style={s.siteGlyph}>⚑</Text>
          <Text style={s.siteMid}>polygrove.io</Text>
          <Text style={s.siteGlyph}>☆</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <HexPhoto uri={photo} width={148} height={167} borderColor={tc} borderWidth={6} />
        </View>
        <View style={{ borderTopWidth: 2, borderTopColor: tc, marginTop: 10, marginBottom: 7 }} />
        <Text style={[s.name, { fontSize: 18 }]} numberOfLines={1}>{card.name}</Text>
        <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
        <Text style={{ fontSize: 12.5, marginTop: 6, marginBottom: 10, fontFamily: F.sans }}>
          <Text style={{ color: tc, fontFamily: F.sansBold }}>{card.trophic || '?'}</Text>
          <Text style={{ color: '#888888' }}> · {card.group}</Text>
        </Text>
        <FieldNote tc={tc} note={note} />
        <View style={{ flex: 0, marginTop: 'auto' }} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap for details</Text></View></View>
      </Animated.View>

      {/* BACK — .face.back */}
      <Animated.View style={[s.phone, backStyle]}>
        <View style={s.head}>
          <HexPhoto uri={photoFor(card.id, 120)} width={46} height={52} borderColor={tc} borderWidth={4} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.name} numberOfLines={1}>{card.name}</Text>
            <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
          </View>
          <Text style={s.ico}>☆</Text>
        </View>
        <View style={s.row}>
          <Box k="Trophic level" v={card.trophic || '?'} vColor={tc} />
          <Box k="Group" v={card.group} />
        </View>
        <View style={s.row}>
          <Box k="Size" v={card.size || '—'} />
          <Box k={slot5label} v={slot5val} />
        </View>
        <FieldNote tc={tc} note={note} />
        <View style={s.fwLabelRow}>
          <View style={s.fwLine} />
          <Text style={s.fwLabel}>FOOD WEB</Text>
          <View style={s.fwLine} />
        </View>
        <MiniWeb card={card} tc={tc} onExpand={() => setFwOpen(true)} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap card to flip</Text></View></View>
        <FoodWebModal card={card} open={fwOpen} onClose={() => setFwOpen(false)} />
      </Animated.View>
    </Pressable>
  );
}

function FieldNote({ tc, note }: { tc: string; note: string | null }) {
  return (
    <View style={[s.note, { borderLeftColor: tc, backgroundColor: `${tc}14` }]}>
      <Text style={[s.noteK, { color: tc }]}>✦ FIELD NOTE</Text>
      <Text style={s.noteTxt} numberOfLines={3}>{note ?? '…'}</Text>
    </View>
  );
}

function Box({ k, v, vColor }: { k: string; v: string; vColor?: string }) {
  return (
    <View style={s.box}>
      <Text style={s.boxK}>{k}</Text>
      <Text style={[s.boxV, vColor ? { color: vColor } : null]} numberOfLines={2}>{v}</Text>
    </View>
  );
}

// the back's mini food web (fwMiniHTML): eaten-by row above, focal center,
// eats row below, grey connectors — neighbor hexes use their card photos.
// FILLS the remaining card space (user, 2026-09-25); tap opens the full web.
function MiniWeb({ card, tc, onExpand }: { card: Card; tc: string; onExpand: () => void }) {
  const [dims, setDims] = useState({ w: 296, h: 148 });
  const eatenBy = (card.foodweb?.eatenBy || []).slice(0, 3);
  const eats = (card.foodweb?.eats || []).slice(0, 3);
  if (!eatenBy.length && !eats.length) {
    return (
      <View style={[s.fwBox, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.faint, fontFamily: F.sans, fontSize: 11 }}>no recorded interactions</Text>
      </View>
    );
  }
  const W = dims.w, H = dims.h, hexW = 30, hexH = 34;
  const topY = Math.max(26, H * 0.18), botY = H - Math.max(30, H * 0.2);
  // one-sided webs center vertically instead of stranding the focal mid-box
  const focalY = eatenBy.length && eats.length ? H / 2
    : eatenBy.length ? H * 0.62 : H * 0.34;
  const colX = (n: number, i: number) => (W / (n + 1)) * (i + 1);
  const rows: { items: typeof eats; y: number }[] = [
    { items: eatenBy, y: eats.length ? topY : H * 0.3 },
    { items: eats, y: eatenBy.length ? botY : H * 0.68 },
  ];
  return (
    <Pressable style={s.fwBox} onPress={onExpand}
      onLayout={e => setDims({ w: e.nativeEvent.layout.width - 24, h: e.nativeEvent.layout.height - 12 })}>
      <View style={s.fwChip}><Text style={s.fwChipTxt}>Tap to expand</Text></View>
      <View style={{ width: W, height: H, alignSelf: 'center' }}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          {eatenBy.map((l, i) => (
            <Line key={`b${i}`} x1={colX(eatenBy.length, i)} y1={rows[0].y + hexH / 2} x2={W / 2} y2={focalY - 4} stroke="#3a3a3a" strokeWidth={1.4} />
          ))}
          {eats.map((l, i) => (
            <Line key={`e${i}`} x1={colX(eats.length, i)} y1={rows[1].y - hexH / 2} x2={W / 2} y2={focalY + 4} stroke="#3a3a3a" strokeWidth={1.4} />
          ))}
        </Svg>
        {rows.map(({ items, y }, r) =>
          items.map((l, i) => {
            const other = cardByName(l.name);
            const oc = other ? (TROPHIC_COLOR[other.trophic] || '#666') : '#444';
            return (
              <View key={`${r}-${i}`} style={{ position: 'absolute', left: colX(items.length, i) - hexW / 2, top: y - hexH / 2, alignItems: 'center' }}>
                <HexPhoto uri={other ? photoFor(other.id, 120) : undefined} width={hexW} height={hexH} borderColor={oc} borderWidth={2} />
                <Text style={s.fwName} numberOfLines={1}>{l.name}</Text>
              </View>
            );
          }))}
        <View style={{ position: 'absolute', left: W / 2 - 19, top: focalY - 21 }}>
          <HexPhoto uri={photoFor(card.id, 120)} width={38} height={42} borderColor={tc} borderWidth={3} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // .phone — the card body itself
  phone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333333', borderRadius: 22,
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 14 },
    elevation: 12, backfaceVisibility: 'hidden', overflow: 'hidden',
  },
  // .dc-site
  site: { flexDirection: 'row', alignItems: 'center', paddingTop: 2, paddingBottom: 7 },
  siteGlyph: { color: '#555555', fontSize: 14, fontFamily: F.sans },
  siteMid: { flex: 1, textAlign: 'center', color: '#555555', fontSize: 11, letterSpacing: 1.1, fontFamily: F.sans },
  // .dc-name / .dc-sci / .dc-ico
  name: { fontFamily: F.display, fontSize: 15, color: C.text },
  sci: { color: '#888888', fontSize: 12, fontFamily: F.sans, fontStyle: 'italic' },
  ico: { marginLeft: 'auto', color: '#555555', fontSize: 16 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  // .dc-row / .dc-box
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  box: { flex: 1, backgroundColor: '#222222', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  boxK: { fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase', color: '#888888', fontFamily: F.sans },
  boxV: { fontSize: 14, marginTop: 3, color: C.text, fontFamily: F.sans, textAlign: 'center' },
  // .dc-note
  note: { borderLeftWidth: 3, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 8 },
  noteK: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: F.sansBold },
  noteTxt: { fontSize: 12.5, color: C.text, fontFamily: F.sans, lineHeight: 17, marginTop: 2 },
  // .dc-fwlabel
  fwLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, marginBottom: 5 },
  fwLine: { flex: 1, height: 1, backgroundColor: '#333333' },
  fwLabel: { color: '#888888', fontSize: 10, letterSpacing: 2.2, fontFamily: F.sans },
  // .dc-fw
  fwBox: { flex: 1, minHeight: 148, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, overflow: 'hidden' },
  fwChip: { position: 'absolute', top: 8, left: 10, backgroundColor: '#2a2a2a', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, zIndex: 2 },
  fwChipTxt: { color: '#999999', fontSize: 10.5, fontFamily: F.sans },
  fwName: { color: '#999999', fontSize: 7.5, fontFamily: F.sans, maxWidth: 64, marginTop: 1 },
  // .dc-pill
  pillRow: { alignItems: 'center', marginTop: 9, marginBottom: 5 },
  pill: { backgroundColor: '#222222', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5 },
  pillTxt: { color: '#999999', fontSize: 12, fontFamily: F.sans },
});
