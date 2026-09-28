// EXACT port of the PolygroveDB explorer card (index.html speciesCardHTML +
// .phone/.dc-* styles). FRONT: ⚑ polygrove.io ☆ text row, 148x167 hex photo,
// 2px accent divider, name/sci/trophic·group, ✦ Field note, "Tap for details".
// BACK: dc-head (46x52 hex + name/sci + ☆), 2x2 centered slot boxes, field
// note, FOOD WEB divider + mini web, "Tap card to flip". Tap flips (0.55s).

import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, photoCommonsPage, photoFor } from '../lib/catalog';
import { GlobiRow, fieldNote, globiRecords } from '../lib/dossier';
import FwGraph from './FwGraph';
import HexPhoto from './HexPhoto';

let _glowSeq = 0;

// anonymous (Q6 "is this your card?"): the name and scientific name are hidden
// and the species' name is masked inside the field note, so the card tests
// recognition — photo, role, group, and the note's diagnostic fact.
// noteFrom: take the field note from ANOTHER card (Q6's chimera — your photo
// wearing the wrong note).
// nameAs (user, 2026-09-28): every Q6 card CLAIMS to be the card in question —
// its name with a "?" plus the plain scientific name — so the names don't tell
// them apart; the note is still masked like an anonymous card.
export default function PolygroveCard({ card: raw, anonymous = false, noteFrom, nameAs }:
  { card: Card; anonymous?: boolean; noteFrom?: Card; nameAs?: { name: string; sci: string } }) {
  const card = nameAs ? { ...raw, name: `${nameAs.name}?`, sci: nameAs.sci } : anonymous ? { ...raw, name: '???', sci: '· · ·' } : raw;
  const hideNames = anonymous || !!nameAs;
  const noteCard = noteFrom ?? raw;
  // explorer's troColor: purple = trophic role is INFERRED (GloBI prey records),
  // not measured — the accent itself flags the uncertainty.
  const tc = card.provenance?.feeding?.confidence === 'inferred'
    ? '#c084fc' : TROPHIC_COLOR[card.trophic] || '#81C784';
  const photo = photoFor(card.id, 500);
  const commons = photoCommonsPage(card.id);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    fieldNote(noteCard.sci).then(n => on && setNote(hideNames && n ? maskName(n, noteCard) : n));
    return () => { on = false; };
  }, [noteCard, hideNames]);

  const router = useRouter();
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [srcPop, setSrcPop] = useState<{ label: string; source: string; confidence: string } | null>(null);

  // "Tap to expand" literally grows the food web box (user, 2026-09-26): the
  // box's measured rect animates out to fill the card face, showing the big
  // labeled web; a tap on the background shrinks it back.
  type Rect = { x: number; y: number; w: number; h: number };
  const [face, setFace] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [box, setBox] = useState<Rect | null>(null);
  const [webBig, setWebBig] = useState(false);
  const [recs, setRecs] = useState<GlobiRow[] | null>(null);
  const [showRecs, setShowRecs] = useState(false);
  const grow = useSharedValue(0);
  const openWeb = () => { setShowRecs(false); setWebBig(true); grow.value = withTiming(1, { duration: 320 }); };
  const closeWeb = () => {
    setShowRecs(false);
    grow.value = withTiming(0, { duration: 260 }, done => { if (done) runOnJS(setWebBig)(false); });
  };
  const bigStyle = useAnimatedStyle(() => {
    const b = box ?? { x: 0, y: 0, w: face.w, h: face.h };
    const g = grow.value;
    return {
      left: b.x + (0 - b.x) * g,
      top: b.y + (0 - b.y) * g,
      width: b.w + (face.w - b.w) * g,
      height: b.h + (face.h - b.h) * g,
      borderRadius: 10 + 12 * g,
    };
  });
  const [glowId] = useState(() => `glow${++_glowSeq}`);
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

  // per-fact source popup (the plan's provenance design, user 2026-09-26):
  // catalog provenance = {source, confidence} per slot
  const showSource = (label: string, key: string) => {
    const pv = card.provenance?.[key];
    if (pv) setSrcPop({ label, source: pv.source, confidence: pv.confidence });
  };
  const slot5label = card.habitat ? 'Habitat' : card.origin ? 'Native origin' : 'Biome';
  const slot5val = card.habitat || card.origin || card.biome || '—';

  return (
    // width/height 100%, NOT flex:1 — flex:1 here collapsed to content height
    // on iOS (found natively on the simulator, 2026-09-25)
    <Pressable onPress={doFlip} style={{ width: '100%', height: '100%' }}>
      {/* FRONT — .face.front */}
      <Animated.View style={[s.phone, frontStyle]}>
        <View style={s.site}>
          <Text style={s.siteGlyph}>⚑</Text>
          <Text style={s.siteMid}>polygrove.io</Text>
          <Text style={s.siteGlyph}>☆</Text>
        </View>
        {/* the demo's photo field (user, 2026-09-26): full-bleed near-black with
            a radial accent glow behind the hex */}
        <View style={s.hexGlow}>
          <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Defs>
              <RadialGradient id={glowId} cx="50%" cy="50%" rx="62%" ry="56%">
                <Stop offset="0" stopColor={tc} stopOpacity={0.21} />
                <Stop offset="0.7" stopColor={tc} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} />
          </Svg>
          <HexPhoto uri={photo} width={148} height={167} borderColor={tc} borderWidth={6} />
          {/* ⓘ bottom-right → the Commons file page (user, 2026-09-26): the ONLY
              full-photo view — our hex crop is an edit, so the uncropped
              original is shown at its source, credited. Nested Pressable so
              the card flip doesn't fire. */}
          {!!commons && (
            <Pressable hitSlop={10} style={[s.photoBtn, { right: 12 }]}
              onPress={() => WebBrowser.openBrowserAsync(commons, {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
              })}>
              <Text style={[s.photoBtnTxt, { fontStyle: 'italic', fontFamily: F.sansBold }]}>i</Text>
            </Pressable>
          )}
        </View>
        <View style={{ borderTopWidth: 2, borderTopColor: tc, marginHorizontal: -16, marginBottom: 7 }} />
        <Text style={[s.name, { fontSize: 18 }]} numberOfLines={1}>{card.name}</Text>
        <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
        <Text style={{ fontSize: 12.5, marginTop: 6, marginBottom: 10, fontFamily: F.sans }}>
          <Text style={{ color: tc, fontFamily: F.sansBold }}>{card.trophic || '?'}</Text>
          <Text style={{ color: '#888888' }}> · {card.group}</Text>
        </Text>
        {/* the demo's faint section line above the field note (user, 2026-09-26) */}
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginHorizontal: -16, marginBottom: 10 }} />
        <FieldNote tc={tc} note={note} sci={card.sci} />
        <View style={{ flex: 0, marginTop: 'auto' }} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap for details</Text></View></View>
      </Animated.View>

      {/* BACK — .face.back */}
      <Animated.View style={[s.phone, backStyle]}
        onLayout={(e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; setFace({ x: 0, y: 0, w: width, h: height }); }}>
        <View style={s.head}>
          <HexPhoto uri={photoFor(card.id, 120)} width={46} height={52} borderColor={tc} borderWidth={4} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.name} numberOfLines={1}>{card.name}</Text>
            <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
          </View>
          <Text style={s.ico}>☆</Text>
        </View>
        <View style={s.row}>
          <Box k="Trophic level" v={card.trophic || '?'} vColor={tc}
            onPress={() => showSource('Trophic level', 'feeding')} />
          <Box k="Group" v={card.group}
            onPress={() => showSource('Group', 'taxonomy')} />
        </View>
        <View style={s.row}>
          <Box k="Size" v={card.size || '—'}
            onPress={() => showSource('Size', 'size')} />
          <Box k={slot5label} v={slot5val}
            onPress={() => showSource(slot5label, 'slot5')} />
        </View>
        <FieldNote tc={tc} note={note} sci={card.sci} />
        <View style={s.fwLabelRow}>
          <View style={s.fwLine} />
          <Text style={s.fwLabel}>FOOD WEB</Text>
          <View style={s.fwLine} />
        </View>
        <MiniWeb card={card} onExpand={openWeb}
          onLayout={e => { const { x, y, width, height } = e.nativeEvent.layout; setBox({ x, y, w: width, h: height }); }} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap card to flip</Text></View></View>

        {/* EXPANDED FOOD WEB — the box, grown to the face */}
        {webBig && (
          <Animated.View style={[s.webBig, bigStyle]}>
            <Pressable style={{ flex: 1 }} onPress={closeWeb}>
              <View style={s.webBigHead}>
                <Text style={s.fwLabel}>FOOD WEB</Text>
                <Text style={s.webBigHint}>tap to shrink</Text>
              </View>
              {/* the square web centered in the tall box; nodes take their own
                  taps, anything else bubbles up to the shrink */}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <View style={{ width: '100%', aspectRatio: 1 }}>
                  <FwGraph card={card} viewW={500} viewH={500} nodeR={20} centerR={32}
                    fontSize={14} radiusFactor={0.34} showLabels
                    onNodePress={cid => router.push(`/species/${cid}`)} />
                </View>
              </View>
              {/* ⓘ: every GloBI record behind this web, in-card */}
              <Pressable hitSlop={10} style={s.webBigI}
                onPress={async () => { setShowRecs(true); if (!recs) setRecs(await globiRecords(card.sci)); }}>
                <Text style={s.webBigITxt}>i</Text>
              </Pressable>
              {showRecs && (
                <Pressable style={s.recWrap} onPress={() => setShowRecs(false)}>
                  <View style={s.recPanel} onStartShouldSetResponder={() => true}>
                    <Text style={s.recTitle}>GloBI RECORDS</Text>
                    <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingBottom: 4 }}>
                      {recs === null ? <Text style={s.recNone}>…</Text>
                        : recs.length === 0 ? <Text style={s.recNone}>no interaction records</Text>
                        : recs.map((r, i) => (
                          <View key={i} style={s.recRow}>
                            <Text style={s.recFact}>{r.fact}{r.derived ? '  · derived' : ''}</Text>
                            <Text style={s.recVal}>{r.value}</Text>
                          </View>
                        ))}
                    </ScrollView>
                    <Pressable onPress={() => WebBrowser.openBrowserAsync('https://www.globalbioticinteractions.org/')}>
                      <Text style={s.recCredit}>source: GloBI ›</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>

      {/* SOURCE POPUP — in-card, tap to dismiss */}
      {srcPop && (
        <Pressable style={s.srcPopWrap} onPress={() => setSrcPop(null)}>
          <View style={s.srcPop}>
            <Text style={s.srcPopLabel}>{srcPop.label.toUpperCase()}</Text>
            <Text style={s.srcPopSource}>{srcPop.source}</Text>
            <View style={[s.srcPopChip, srcPop.confidence === 'measured' ? s.chipMeasured : srcPop.confidence === 'inferred' ? s.chipInferred : s.chipDerived]}>
              <Text style={s.srcPopChipTxt}>{srcPop.confidence}</Text>
            </View>
            <Text style={s.srcPopHint}>tap to close</Text>
          </View>
        </Pressable>
      )}

    </Pressable>
  );
}

// blank the common name, the binomial, the genus and the name's last "kind"
// word (hog, duck, warbler) in a field note — NOT every word of the name, or
// a Red River Hog's "near rivers" would vanish too
function maskName(note: string, c: Card): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = note;
  const genus = c.sci.split(' ')[0];
  const words = c.name.split(/[\s-]+/);
  const kind = words[words.length - 1];
  const phrases = [c.name, c.sci, genus, ...(kind && kind.length > 2 ? [kind] : [])];
  for (const p of phrases) {
    if (!p) continue;
    out = out.replace(new RegExp(`\\b(?:the\\s+)?${esc(p)}s?\\b`, 'gi'), 'this species');
  }
  return out.replace(/\bthis species\b(\s+this species\b)+/g, 'this species')
    .replace(/^this species/, 'This species');
}

function FieldNote({ tc, note, sci }: { tc: string; note: string | null; sci: string }) {
  // tap opens the article the note came from (user, 2026-09-26) — Wikipedia's
  // Go search resolves scientific names through redirects
  const wiki = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(sci)}&go=Go`;
  return (
    <Pressable style={[s.note, { borderLeftColor: tc, backgroundColor: `${tc}14` }]}
      onPress={() => WebBrowser.openBrowserAsync(wiki)}>
      <Text style={[s.noteK, { color: tc }]}>✦ FIELD NOTE</Text>
      <Text style={s.noteTxt} numberOfLines={3}>
        {note ?? '…'}
        {note ? <Text style={{ color: '#666666', fontSize: 10.5 }}>  — Wikipedia</Text> : null}
      </Text>
    </Pressable>
  );
}

function Box({ k, v, vColor, onPress }: { k: string; v: string; vColor?: string; onPress?: () => void }) {
  return (
    <Pressable style={s.box} onPress={onPress} disabled={!onPress}>
      <Text style={s.boxK}>{k}</Text>
      <Text style={[s.boxV, vColor ? { color: vColor } : null]} numberOfLines={2}>{v}</Text>
    </Pressable>
  );
}

// the back's mini food web — the shared fwGraphSVG port, 'sm' instance
// (300x200, nodeR 9, centerR 16, no labels), same as the website's card.
// Tap grows the box into the full labeled web (onLayout feeds the animation).
function MiniWeb({ card, onExpand, onLayout }: { card: Card; onExpand: () => void; onLayout: (e: LayoutChangeEvent) => void }) {
  const hasWeb = (card.foodweb?.eatenBy?.length || 0) + (card.foodweb?.eats?.length || 0) > 0;
  if (!hasWeb) {
    return (
      <View style={[s.fwBox, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.faint, fontFamily: F.sans, fontSize: 11 }}>no recorded interactions</Text>
      </View>
    );
  }
  return (
    <Pressable style={s.fwBox} onPress={onExpand} onLayout={onLayout}>
      <View style={s.fwChip}><Text style={s.fwChipTxt}>Tap to expand</Text></View>
      <FwGraph card={card} viewW={300} viewH={200} nodeR={9} centerR={16}
        fontSize={8} radiusFactor={0.34} showLabels={false} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // .phone — the card body itself
  phone: {
    // explicit insets, NOT ...StyleSheet.absoluteFillObject — the spread
    // silently fails on iOS Fabric here (found on the simulator, 2026-09-25)
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333333', borderRadius: 22,
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 14 },
    elevation: 12, backfaceVisibility: 'hidden', overflow: 'hidden',
  },
  // .dc-site
  site: { flexDirection: 'row', alignItems: 'center', paddingTop: 2, paddingBottom: 7 },
  siteGlyph: { color: '#666666', fontSize: 14, fontFamily: F.sans, lineHeight: 17, width: 23, textAlign: 'center' },
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
  // the expanded food web — the box grown to the face
  webBig: { position: 'absolute', backgroundColor: '#161616', overflow: 'hidden', zIndex: 15, padding: 10 },
  webBigHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4 },
  webBigHint: { color: '#555555', fontSize: 10, fontFamily: F.sans },
  webBigI: {
    position: 'absolute', right: 12, bottom: 12, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  webBigITxt: { color: '#999999', fontSize: 13, fontStyle: 'italic', fontFamily: F.sansBold },
  recWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 14 },
  recPanel: { backgroundColor: '#1e1e1e', borderRadius: 14, borderWidth: 1, borderColor: '#333333', padding: 14, width: '100%' },
  recTitle: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#888888', textAlign: 'center', marginBottom: 6 },
  recRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingVertical: 7 },
  recFact: { fontFamily: F.sansBold, fontSize: 12, color: C.text },
  recVal: { fontFamily: F.sans, fontSize: 11, color: '#999999', marginTop: 2, lineHeight: 15 },
  recNone: { fontFamily: F.sans, fontSize: 12, color: '#666666', textAlign: 'center', marginVertical: 14 },
  recCredit: { fontFamily: F.sansMed, fontSize: 11, color: C.greenSoft, textAlign: 'center', marginTop: 8 },
  fwChipTxt: { color: '#999999', fontSize: 10.5, fontFamily: F.sans },
  fwName: { color: '#999999', fontSize: 7.5, fontFamily: F.sans, maxWidth: 64, marginTop: 1 },
  // photo-area corner buttons (demo's attribution-i styling)
  // the gap to the left border and to the divider below is EQUAL (a square
  // corner of space, user 2026-09-26) — keep bottom in sync with the left:12
  photoBtn: {
    position: 'absolute', bottom: 12, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoBtnTxt: { color: '#6e6e6e', fontSize: 11, lineHeight: 13 },
  // the demo's photo field: EXACT #111 black base (radial accent glow on top),
  // full-bleed past the card padding (user, 2026-09-26)
  hexGlow: {
    flex: 1, minHeight: 190, marginHorizontal: -16, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  // per-fact source popup
  srcPopWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  srcPop: {
    backgroundColor: '#222222', borderRadius: 14, borderWidth: 1, borderColor: '#3a3a3a',
    paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', maxWidth: 260,
  },
  srcPopLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.4, color: '#888888' },
  srcPopSource: { fontFamily: F.sansMed, fontSize: 13.5, color: C.text, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  srcPopChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginTop: 9, borderWidth: 1 },
  chipMeasured: { backgroundColor: 'rgba(76,175,80,0.15)', borderColor: 'rgba(76,175,80,0.4)' },
  chipInferred: { backgroundColor: 'rgba(245,166,35,0.15)', borderColor: 'rgba(245,166,35,0.4)' },
  chipDerived: { backgroundColor: 'rgba(100,181,246,0.15)', borderColor: 'rgba(100,181,246,0.4)' },
  srcPopChipTxt: { fontFamily: F.sansBold, fontSize: 10.5, color: C.text },
  srcPopHint: { fontFamily: F.sans, fontSize: 9.5, color: '#555555', marginTop: 8 },
  // .dc-pill
  pillRow: { alignItems: 'center', marginTop: 9, marginBottom: 5 },
  pill: { backgroundColor: '#222222', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5 },
  pillTxt: { color: '#999999', fontSize: 12, fontFamily: F.sans },
});
