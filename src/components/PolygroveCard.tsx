// EXACT port of the PolygroveDB explorer card (index.html speciesCardHTML +
// .phone/.dc-* styles). FRONT: ⚑ polygrove.io ☆ text row, 148x167 hex photo,
// 2px accent divider, name/sci/trophic·group, ✦ Field note, "Tap for details".
// BACK: dc-head (46x52 hex + name/sci + ☆), 2x2 centered slot boxes, field
// note, FOOD WEB divider + mini web, "Tap card to flip". Tap flips (0.55s).

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image as SvgImage, ClipPath, Defs, G, Line, Polygon, Svg } from 'react-native-svg';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, FoodwebLink, cardByName, photoFor } from '../lib/catalog';
import { fieldNote } from '../lib/dossier';
import HexPhoto from './HexPhoto';

export default function PolygroveCard({ card }: { card: Card }) {
  const tc = TROPHIC_COLOR[card.trophic] || '#81C784';
  const photo = photoFor(card.id, 500);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { let on = true; fieldNote(card.sci).then(n => on && setNote(n)); return () => { on = false; }; }, [card.sci]);

  const router = useRouter();
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
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
        <MiniWeb card={card} tc={tc} onExpand={() => router.push(`/web/${card.id}`)} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap card to flip</Text></View></View>
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

// the back's mini food web — EXACT port of the explorer's fwGraphSVG (index.html
// :805, 'sm' instance: viewBox 300x200, nodeR 9, centerR 16, radiusFactor 0.34,
// no labels): predators fan the top semicircle, prey the bottom, arrows flow
// DOWN and meet each hexagon exactly at its boundary. Tap opens the full web.
const hexPtsStr = (x: number, y: number, r: number) =>
  `${x},${y - r} ${x + r},${y - r / 2} ${x + r},${y + r / 2} ${x},${y + r} ${x - r},${y + r / 2} ${x - r},${y - r / 2}`;
function rayHex(x: number, y: number, s2: number, ux: number, uy: number): [number, number] {
  const V = [[x, y - s2], [x + s2, y - s2 / 2], [x + s2, y + s2 / 2], [x, y + s2], [x - s2, y + s2 / 2], [x - s2, y - s2 / 2]];
  let best: [number, number] = [x + ux * s2, y + uy * s2], bt = 1e9;
  for (let e = 0; e < 6; e++) {
    const [x1, y1] = V[e], [x2, y2] = V[(e + 1) % 6], ex = x2 - x1, ey = y2 - y1;
    const den = ux * ey - uy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - x) * ey - (y1 - y) * ex) / den; if (t <= 0 || t >= bt) continue;
    const u = Math.abs(ex) > Math.abs(ey) ? ((x + t * ux) - x1) / ex : ((y + t * uy) - y1) / ey;
    if (u >= -0.001 && u <= 1.001) { bt = t; best = [x + t * ux, y + t * uy]; }
  }
  return best;
}
function MiniWeb({ card, tc, onExpand }: { card: Card; tc: string; onExpand: () => void }) {
  const preds = (card.foodweb?.eatenBy || []).slice(0, 4);
  const prey = (card.foodweb?.eats || []).slice(0, 4);
  if (!preds.length && !prey.length) {
    return (
      <View style={[s.fwBox, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.faint, fontFamily: F.sans, fontSize: 11 }}>no recorded interactions</Text>
      </View>
    );
  }
  const W = 300, H = 200, nodeR = 9, centerR = 16;
  const cx = W / 2, cy = H / 2, rowOff = Math.min(W, H) * 0.34;
  const mk = (list: FoodwebLink[], pred: boolean) => list.map((sp, i) => {
    const a = ((pred ? -180 : 0) + (i + 0.5) * 180 / list.length) * Math.PI / 180;
    return { ...sp, x: cx + Math.cos(a) * rowOff, y: cy + Math.sin(a) * rowOff, pred };
  });
  const nodes = [...mk(preds, true), ...mk(prey, false)];
  let clipSeq = 0;
  return (
    <Pressable style={s.fwBox} onPress={onExpand}>
      <View style={s.fwChip}><Text style={s.fwChipTxt}>Tap to expand</Text></View>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        {nodes.map((sp, i) => {
          const dx = sp.x - cx, dy = sp.y - cy, dist = Math.hypot(dx, dy), ux = dx / dist, uy = dy / dist;
          const [fx, fy] = rayHex(cx, cy, centerR + 1, ux, uy);
          const [nx2, ny2] = rayHex(sp.x, sp.y, nodeR + 1, -ux, -uy);
          // top: predator → focal; bottom: focal → prey — arrows always flow DOWN
          const [x1, y1, x2, y2] = sp.pred ? [nx2, ny2, fx, fy] : [fx, fy, nx2, ny2];
          const lux = (x2 - x1) / Math.hypot(x2 - x1, y2 - y1), luy = (y2 - y1) / Math.hypot(x2 - x1, y2 - y1);
          const bx = x2 - lux * 6.5, by = y2 - luy * 6.5, px = -luy, py = lux;
          return (
            <G key={`l${i}`}>
              <Line x1={x1} y1={y1} x2={bx} y2={by} stroke="#3a3a3a" strokeWidth={1.2} />
              <Polygon points={`${x2},${y2} ${bx + px * 3},${by + py * 3} ${bx - px * 3},${by - py * 3}`} fill="#5a5a5a" />
            </G>
          );
        })}
        {nodes.map((sp, i) => {
          const t = cardByName(sp.name);
          const accent = t ? (TROPHIC_COLOR[t.trophic] || '#8fa08f') : '#8fa08f';
          const nph = t ? photoFor(t.id, 120) : undefined;
          const cid = `mw${clipSeq++}`;
          return nph ? (
            <G key={`n${i}`}>
              <Defs><ClipPath id={cid}><Polygon points={hexPtsStr(sp.x, sp.y, nodeR)} /></ClipPath></Defs>
              <Polygon points={hexPtsStr(sp.x, sp.y, nodeR)} fill="#1a1a1a" />
              <SvgImage href={{ uri: nph }} x={sp.x - nodeR} y={sp.y - nodeR} width={nodeR * 2} height={nodeR * 2}
                preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} />
              <Polygon points={hexPtsStr(sp.x, sp.y, nodeR)} fill="none" stroke={accent} strokeWidth={1.2} strokeLinejoin="round" />
            </G>
          ) : (
            <Polygon key={`n${i}`} points={hexPtsStr(sp.x, sp.y, nodeR)}
              fill={t ? accent : '#444'} stroke={t ? '#1a1a1a' : accent} strokeWidth={1} strokeLinejoin="round" opacity={t ? 1 : 0.85} />
          );
        })}
        <Defs><ClipPath id="mwfocal"><Polygon points={hexPtsStr(cx, cy, centerR)} /></ClipPath></Defs>
        <Polygon points={hexPtsStr(cx, cy, centerR)} fill="#1a1a1a" />
        {!!photoFor(card.id, 120) && (
          <SvgImage href={{ uri: photoFor(card.id, 120)! }} x={cx - centerR} y={cy - centerR}
            width={centerR * 2} height={centerR * 2} preserveAspectRatio="xMidYMid slice" clipPath="url(#mwfocal)" />
        )}
        <Polygon points={hexPtsStr(cx, cy, centerR)} fill="none" stroke={tc} strokeWidth={3} strokeLinejoin="round" />
      </Svg>
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
