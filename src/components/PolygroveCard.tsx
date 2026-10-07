// EXACT port of the PolygroveDB explorer card (index.html speciesCardHTML +
// .phone/.dc-* styles). FRONT: ⚑ polygrove.io ☆ text row, 148x167 hex photo,
// 2px accent divider, name/sci/trophic·group, ✦ Field note, "Tap for details".
// BACK: dc-head (46x52 hex + name/sci + ☆), 2x2 centered slot boxes, field
// note, FOOD WEB divider + mini web, "Tap card to flip". Tap flips (0.55s).

import { useRouter } from 'expo-router';
import { openWeb as openPage } from '../lib/web';   // `openWeb` here is the card's own food-web expander
import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolate, interpolateColor, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, fmtImperial, fmtSize, parseSize, photoCommonsPage, photoFor, framingFor, sizeFrac, sizeRange, soundsFor } from '../lib/catalog';
import SoundButton from './SoundButton';
import { GlobiRow, fieldNote, globiRecords } from '../lib/dossier';
import { FactKey, SightingInfo, niceDate } from '../lib/sightings';
import { toggleStar, useStars } from '../lib/stars';
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
// demoFrame (pack opening, user 2026-09-29): the demo's card exactly — the
// big 200×226 hexagon, the 3px border and the drop shadow.
// sighting: a CUSTOM card (user, 2026-10-05) — one your own iNaturalist
// observation gave you. It wears YOUR photo (when you shared it under a
// licence) and its field note is the observation itself: when, where, how
// many people agreed. The ⓘ opens the observation.
// missing: an INCOMPLETE card, previewed "as it could be" — the facts the
// database doesn't have yet are written in red.
const MISSING_RED = '#E57373';
export default function PolygroveCard({ card: raw, anonymous = false, noteFrom, nameAs, demoFrame = false, sighting, missing }:
  { card: Card; anonymous?: boolean; noteFrom?: Card; nameAs?: { name: string; sci: string }; demoFrame?: boolean;
    sighting?: SightingInfo; missing?: FactKey[] }) {
  const lacks = (k: FactKey) => !!missing?.includes(k);
  const card = nameAs ? { ...raw, name: `${nameAs.name}?`, sci: nameAs.sci } : anonymous ? { ...raw, name: '???', sci: '· · ·' } : raw;
  const hideNames = anonymous || !!nameAs;
  const noteCard = noteFrom ?? raw;
  // explorer's troColor: purple = trophic role is INFERRED (GloBI prey records),
  // not measured — the accent itself flags the uncertainty.
  const tc = card.provenance?.feeding?.confidence === 'inferred'
    ? '#c084fc' : TROPHIC_COLOR[card.trophic] || '#81C784';
  const sound = hideNames ? undefined : soundsFor(raw.sci)[0];   // not on a quiz card: the call would give it away
  const own = sighting?.photo || undefined;             // your photo, uncropped by our framing data
  const photo = own ?? photoFor(card.id, 500);
  const frame = own ? undefined : framingFor(raw.id);
  const commons = sighting ? sighting.uri : photoCommonsPage(card.id);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    fieldNote(noteCard.sci).then(n => on && setNote(hideNames && n ? maskName(n, noteCard) : n)).catch(() => { /* no note */ });
    return () => { on = false; };
  }, [noteCard, hideNames]);

  const router = useRouter();
  // THE STAR (user, 2026-10-06): a tap on either face's ☆ stars the card for
  // the journal's star filter; it takes the tap, so the card does not flip
  // on a quiz card the star is hidden and inert — a starred card would give
  // away which is yours (user, 2026-10-06)
  const stars = useStars();
  const starred = !hideNames && stars.has(card.id);
  const star = () => { if (!hideNames) toggleStar(card.id); };
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [srcPop, setSrcPop] = useState<{ label: string; source: string; confidence: string } | null>(null);

  // "Tap to expand" opens the food web FULL SCREEN (user, 2026-10-06: "like
  // it was before and on the website" — the website's fwExpand overlay). For
  // a while it grew to the card face, which is small when the card sits above
  // a honeycomb.
  // It GROWS OUT OF THE CARD (user, 2026-10-06: "have it come out of the
  // card and expand to full screen"): the mini web's box is measured on
  // screen and a panel animates from that rectangle to the whole window.
  const [webBig, setWebBig] = useState(false);
  const [recs, setRecs] = useState<GlobiRow[] | null>(null);
  const [showRecs, setShowRecs] = useState(false);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const boxRef = useRef<View>(null);
  const from = useSharedValue({ x: 0, y: 0, w: win.width, h: win.height });
  const grow = useSharedValue(0);
  const openWeb = () => {
    setShowRecs(false);
    const go = () => { setWebBig(true); grow.value = 0; grow.value = withTiming(1, { duration: 380 }); };
    const node = boxRef.current;
    if (node) node.measureInWindow((x, y, w, h) => { from.value = { x, y, w, h }; go(); });
    else go();
  };
  const closeWeb = () => {
    setShowRecs(false);
    grow.value = withTiming(0, { duration: 300 }, done => { if (done) runOnJS(setWebBig)(false); });
  };
  const panelStyle = useAnimatedStyle(() => {
    const g = grow.value, b = from.value;
    return {
      left: b.x * (1 - g), top: b.y * (1 - g),
      width: b.w + (win.width - b.w) * g, height: b.h + (win.height - b.h) * g,
      borderRadius: 10 * (1 - g),
      backgroundColor: interpolateColor(g, [0, 1], ['#1c1c1c', '#0d0d0d']),
    };
  });
  const insideStyle = useAnimatedStyle(() => ({ opacity: interpolate(grow.value, [0.35, 1], [0, 1], 'clamp') }));
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
      <Animated.View style={[s.phone, demoFrame && s.phoneDemo, frontStyle]}>
        <View style={s.site}>
          <Text style={s.siteGlyph}>⚑</Text>
          <Text style={s.siteMid}>polygrove.io</Text>
          <Pressable onPress={star} hitSlop={10} disabled={hideNames}><Text style={[s.siteGlyph, starred && s.starOn]}>{starred ? '★' : '☆'}</Text></Pressable>
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
          <HexPhoto uri={photo} frame={frame} width={demoFrame ? 200 : 148} height={demoFrame ? 226 : 167} borderColor={tc} borderWidth={6} />
          {/* ⓘ bottom-right → the Commons file page (user, 2026-09-26): the ONLY
              full-photo view — our hex crop is an edit, so the uncropped
              original is shown at its source, credited. Nested Pressable so
              the card flip doesn't fire. */}
          {!!commons && (
            <Pressable hitSlop={10} style={[s.photoBtn, { right: 12 }]}
              onPress={() => openPage(commons)}>
              <Text style={[s.photoBtnTxt, { fontStyle: 'italic', fontFamily: F.sansBold }]}>i</Text>
            </Pressable>
          )}
        </View>
        <View style={{ borderTopWidth: 2, borderTopColor: tc, marginHorizontal: -16, marginBottom: 7 }} />
        <Text style={[s.name, { fontSize: 18 }]} numberOfLines={1}>{card.name}</Text>
        <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
        <Text style={{ fontSize: 12.5, marginTop: 6, marginBottom: 10, fontFamily: F.sans }}>
          {lacks('feeding') ? <Text style={{ color: MISSING_RED, fontFamily: F.sansBold }}>feeding role missing</Text>
            : <Text style={{ color: tc, fontFamily: F.sansBold }}>{card.trophic || '?'}</Text>}
          <Text style={{ color: '#888888' }}>{card.group ? ` · ${card.group}` : ''}</Text>
        </Text>
        {/* the animal's SOUND, between the role line and the field note (user, 2026-10-06) */}
        {sound ? <SoundButton sound={sound} /> : null}
        {/* the demo's faint section line above the field note (user, 2026-09-26) */}
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginHorizontal: -16, marginBottom: 10 }} />
        {sighting ? <SightingNote tc={tc} s={sighting} /> : <FieldNote tc={tc} note={note} sci={card.sci} />}
        <View style={{ flex: 0, marginTop: 'auto' }} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap for details</Text></View></View>
      </Animated.View>

      {/* BACK — .face.back */}
      <Animated.View style={[s.phone, demoFrame && s.phoneDemo, backStyle]}>
        <View style={s.head}>
          <HexPhoto uri={own ?? photoFor(card.id, 120)} frame={frame} width={46} height={52} borderColor={tc} borderWidth={4} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.name} numberOfLines={1}>{card.name}</Text>
            <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
          </View>
          <Pressable onPress={star} hitSlop={10} disabled={hideNames}><Text style={[s.ico, starred && s.starOn]}>{starred ? '★' : '☆'}</Text></Pressable>
        </View>
        {/* the 2×2 order (user, 2026-10-06): Habitat · Group / Size · Trophic level */}
        <View style={s.row}>
          <Box k={slot5label} v={slot5val} missing={lacks('slot5') || (!card.habitat && !card.origin && lacks('biome'))}
            onPress={() => showSource(slot5label, 'slot5')} />
          <Box k="Group" v={card.group}
            onPress={() => showSource('Group', 'taxonomy')} />
        </View>
        <View style={s.row}>
          <Box k="Size" v={sizeLabel(card.size)} missing={lacks('size')}
            onPress={() => showSource('Size', 'size')} extra={<SizeBar card={card} tc={tc} />} />
          <Box k="Trophic level" v={card.trophic || '?'} vColor={tc} missing={lacks('feeding')}
            onPress={() => showSource('Trophic level', 'feeding')} />
        </View>
        {/* a custom card's BACK keeps the species' field note when there is one
            (user, 2026-10-05); the sighting is on the front, and stands in here
            only when no note exists */}
        {sighting && !note ? <SightingNote tc={tc} s={sighting} /> : <FieldNote tc={tc} note={note} sci={card.sci} />}
        <View style={s.fwLabelRow}>
          <View style={s.fwLine} />
          <Text style={[s.fwLabel, lacks('foodweb') && { color: MISSING_RED }]}>{lacks('foodweb') ? 'FOOD WEB · MISSING' : 'FOOD WEB'}</Text>
          <View style={s.fwLine} />
        </View>
        <MiniWeb card={card} onExpand={openWeb} boxRef={boxRef} />
        <View style={s.pillRow}><View style={s.pill}><Text style={s.pillTxt}>Tap card to flip</Text></View></View>

        {/* EXPANDED FOOD WEB — full screen, over everything */}
        <Modal visible={webBig} transparent animationType="none" statusBarTranslucent onRequestClose={closeWeb}>
          <Animated.View style={[s.webBigPanel, panelStyle]}>
          <Animated.View style={[{ flex: 1 }, insideStyle]}>
          <Pressable style={[s.webBig, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]} onPress={closeWeb}>
            {/* the name, then FOOD WEB under it, centred at the top (user, 2026-10-06) */}
            <View style={s.webBigHead}>
              <Text style={s.webBigName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{hideNames ? '?' : card.name}</Text>
              <Text style={s.webBigLabel}>FOOD WEB</Text>
            </View>
            {/* the square web, as wide as the screen; nodes take their own
                taps, anything else bubbles up to the close */}
            {/* the web fills the width; the view box is taller than wide so the
                outer labels have room (user, 2026-10-06: "proportions are off") */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: win.width, height: Math.round(win.width * 560 / 500), marginHorizontal: -16 }}>
                <FwGraph card={card} viewW={500} viewH={560} nodeR={26} centerR={40}
                  fontSize={15} radiusFactor={0.37} showLabels
                  onNodePress={cid => { closeWeb(); router.push(`/species/${cid}`); }} />
              </View>
            </View>
            <Pressable onPress={closeWeb} hitSlop={12} style={[s.webBigX, { top: insets.top + 8, right: 16 }]}><Text style={s.webBigXTxt}>✕</Text></Pressable>
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
                    <Pressable onPress={() => openPage('https://www.globalbioticinteractions.org/')}>
                      <Text style={s.recCredit}>source: GloBI ›</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
          </Pressable>
          </Animated.View>
          </Animated.View>
        </Modal>
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

// a custom card's note: the observation itself, in the field note's place.
// Tap opens it on iNaturalist; the photo's credit always shows.
function SightingNote({ tc, s: o }: { tc: string; s: SightingInfo }) {
  const first = [niceDate(o.date), o.place].filter(Boolean).join(' · ') || 'No date or place given';
  const second = [
    o.pending ? 'waiting for the community to confirm it' : o.agree ? `${o.agree} ${o.agree === 1 ? 'person agrees' : 'people agree'} on what it is` : 'confirmed',
    o.seen && o.seen > 1 ? `seen here ${o.seen} times` : null,
  ].filter(Boolean).join(' · ');
  return (
    <Pressable style={[s.note, { borderLeftColor: tc, backgroundColor: `${tc}14` }]} disabled={!o.uri}
      onPress={() => o.uri && openPage(o.uri)}>
      <Text style={[s.noteK, { color: tc }]}>✦ {o.pending ? 'SIGHTING' : 'YOUR SIGHTING'}</Text>
      <Text style={s.noteTxt} numberOfLines={2}>{first}</Text>
      <Text style={[s.noteTxt, { color: '#aaa', marginTop: 1 }]} numberOfLines={1}>{second}</Text>
      <Text style={s.noteSrc} numberOfLines={1}>— iNaturalist{o.photo && o.credit ? ` · photo ${o.credit}` : ''}</Text>
    </Pressable>
  );
}

function FieldNote({ tc, note, sci }: { tc: string; note: string | null; sci: string }) {
  // tap opens the article the note came from (user, 2026-09-26) — Wikipedia's
  // Go search resolves scientific names through redirects
  const wiki = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(sci)}&go=Go`;
  return (
    <Pressable style={[s.note, { borderLeftColor: tc, backgroundColor: `${tc}14` }]}
      onPress={() => openPage(wiki)}>
      <Text style={[s.noteK, { color: tc }]}>✦ FIELD NOTE</Text>
      {/* the credit is its OWN line (user, 2026-09-29): inside the note's text a
          long note's "…" swallowed it — the source must show however long the note is */}
      <Text style={s.noteTxt} numberOfLines={3}>{note ?? '…'}</Text>
      {note ? <Text style={s.noteSrc} numberOfLines={1}>— Wikipedia</Text> : null}
    </Pressable>
  );
}

function Box({ k, v, vColor, onPress, missing = false, extra }: { k: string; v: string; vColor?: string; onPress?: () => void; missing?: boolean; extra?: ReactNode }) {
  return (
    <Pressable style={[s.box, missing && { borderWidth: 1, borderColor: 'rgba(229,115,115,0.5)' }]} onPress={onPress} disabled={!onPress || missing}>
      <Text style={s.boxK}>{k}</Text>
      <Text style={[s.boxV, vColor ? { color: vColor } : null, missing && { color: MISSING_RED }]} numberOfLines={2}>{missing ? 'missing' : v}</Text>
      {!missing && extra}
    </Pressable>
  );
}

// "2.1 kg | 4.7 lb": the metric size in a relatable unit (grams → kg → t,
// cm → m, mm → cm) with its imperial twin to the right (user, 2026-10-06:
// "so many grams should be converted to something more relatable")
function sizeLabel(size?: string | null): string {
  if (!size) return '—';
  const sz = parseSize(size);
  return sz ? `${fmtSize(sz.v, sz.unit)} | ${fmtImperial(sz.v, sz.unit)}` : size;
}

// SIZE IN CONTEXT (user, 2026-10-06): under the size, a bar from the smallest
// to the largest card of the same group (same unit), filled to this one's
// place on a log scale; the ends are labelled
function SizeBar({ card, tc }: { card: Card; tc: string }) {
  const sz = parseSize(card.size);
  const r = sz ? sizeRange(card.group, sz.unit) : null;
  if (!sz || !r) return null;
  const frac = sizeFrac(sz.v, r);
  return (
    <View style={s.szWrap}>
      <View style={s.szTrack}>
        <View style={[s.szFill, { width: `${Math.round(frac * 100)}%`, backgroundColor: tc }]} />
        <View style={[s.szDot, { left: `${Math.round(frac * 100)}%`, backgroundColor: tc }]} />
      </View>
      <View style={s.szEnds}>
        <Text style={s.szEnd}>{fmtSize(r.min, sz.unit)} | {fmtImperial(r.min, sz.unit)}</Text>
        <Text style={s.szEnd}>{fmtSize(r.max, sz.unit)} | {fmtImperial(r.max, sz.unit)}</Text>
      </View>
    </View>
  );
}

// the back's mini food web — the shared fwGraphSVG port, 'sm' instance
// (300x200, nodeR 9, centerR 16, no labels), same as the website's card.
// Tap grows the box into the full labeled web (onLayout feeds the animation).
function MiniWeb({ card, onExpand, boxRef }: { card: Card; onExpand: () => void; boxRef: RefObject<View | null> }) {
  const hasWeb = (card.foodweb?.eatenBy?.length || 0) + (card.foodweb?.eats?.length || 0) > 0;
  if (!hasWeb) {
    return (
      <View style={[s.fwBox, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C.faint, fontFamily: F.sans, fontSize: 11 }}>no recorded interactions</Text>
      </View>
    );
  }
  return (
    <Pressable ref={boxRef} style={s.fwBox} onPress={onExpand}>
      <View style={s.fwChip}><Text style={s.fwChipTxt}>Tap to expand</Text></View>
      <FwGraph card={card} viewW={300} viewH={160} nodeR={9} centerR={16}
        fontSize={8} radiusFactor={0.425} showLabels={false} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  // .phone — the card body itself
  // the demo's CardDisplay frame: border 3px #333, radius 20, shadow 0 8px 32px rgba(0,0,0,.5)
  phoneDemo: {
    borderWidth: 3, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
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
  starOn: { color: C.yellow },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  // .dc-row / .dc-box
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  box: { flex: 1, backgroundColor: '#222222', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },   // centred both ways: a box beside the taller Size box sat high (user, 2026-10-06)
  boxK: { fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase', color: '#888888', fontFamily: F.sans },
  boxV: { fontSize: 14, marginTop: 3, color: C.text, fontFamily: F.sans, textAlign: 'center' },
  // the size bar: a 3px track, the fill in the card's role colour, a dot at this species, tiny end labels
  szWrap: { alignSelf: 'stretch', marginTop: 5 },
  szTrack: { height: 3, borderRadius: 2, backgroundColor: '#3a3a3a', overflow: 'visible' },
  szFill: { height: 3, borderRadius: 2 },
  szDot: { position: 'absolute', top: -2.5, width: 8, height: 8, borderRadius: 4, marginLeft: -4, borderWidth: 1.5, borderColor: '#222222' },
  szEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  szEnd: { fontSize: 7.5, color: '#777777', fontFamily: F.sans },   // the ends carry imperial too (user, 2026-10-06)
  // .dc-note
  note: { borderLeftWidth: 3, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 8 },
  noteK: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: F.sansBold },
  noteTxt: { fontSize: 12.5, color: C.text, fontFamily: F.sans, lineHeight: 17, marginTop: 2 },
  noteSrc: { fontSize: 10.5, color: '#666666', fontFamily: F.sans, marginTop: 3 },
  // .dc-fwlabel
  fwLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, marginBottom: 5 },
  fwLine: { flex: 1, height: 1, backgroundColor: '#333333' },
  fwLabel: { color: '#888888', fontSize: 10, letterSpacing: 2.2, fontFamily: F.sans },
  // .dc-fw
  // as tight as the drawing (user, 2026-10-06: "as tight as possible so the card
  // isn't too big … keep the size of the image"): the box follows the 300×160
  // view box, so the web draws at the same size with no dead space around it
  fwBox: { aspectRatio: 300 / 160, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden' },
  fwChip: { position: 'absolute', top: 6, left: 6, backgroundColor: '#2a2a2a', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, zIndex: 2 },
  // the expanded food web — the box grown to the face
  webBigPanel: { position: 'absolute', overflow: 'hidden' },
  webBig: { flex: 1, paddingHorizontal: 16 },
  webBigName: { fontFamily: F.display, fontSize: 26, color: C.text, textAlign: 'center' },
  webBigLabel: { color: '#888888', fontSize: 12, letterSpacing: 3, fontFamily: F.sans },
  webBigX: {
    position: 'absolute', zIndex: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  webBigXTxt: { color: C.text, fontSize: 15, lineHeight: 18 },
  webBigHead: { alignItems: 'center', paddingTop: 44, paddingHorizontal: 24, gap: 4 },
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
  fwChipTxt: { color: '#999999', fontSize: 9, fontFamily: F.sans },
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
