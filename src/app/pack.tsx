import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, getCards, photoFor } from '../lib/catalog';
import { addToCollection, owns } from '../lib/collection';

const PACK_SIZE = 5;

function drawPack(): Card[] {
  const all = getCards();
  // prefer species the player doesn't own yet, and cards with a photo — a pack
  // should feel like five little discoveries
  const pool = all.filter(c => !owns(c.species_id) && photoFor(c.id));
  const src = pool.length >= PACK_SIZE ? pool : all;
  const pack: Card[] = [];
  const seen = new Set<number>();
  while (pack.length < PACK_SIZE && seen.size < src.length) {
    const c = src[Math.floor(Math.random() * src.length)];
    if (seen.has(c.species_id)) continue;
    seen.add(c.species_id);
    pack.push(c);
  }
  return pack;
}

export default function PackOpening() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // deep-loaded with a cold catalog → bounce to Home, which loads it
  const catReady = getCards().length > 0;
  useEffect(() => { if (!catReady) router.replace('/'); }, [catReady, router]);
  const pack = useMemo(drawPack, []);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const done = idx >= pack.length;
  const card = pack[idx];

  const flip = useSharedValue(0);   // 0 = face down, 1 = revealed
  const slide = useSharedValue(0);  // card-advance offset

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value * 180}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 }, { rotateY: `${180 + flip.value * 180}deg` },
      { translateX: slide.value },
    ],
    opacity: flip.value < 0.5 ? 0 : 1,
  }));

  if (!catReady) return null;   // (after every hook — order must stay stable)

  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    flip.value = withSpring(1, { damping: 14, stiffness: 90 });
  };

  const collect = () => {
    if (!card) return;
    if (addToCollection(card)) setNewCount(n => n + 1);
    slide.value = withTiming(-500, { duration: 220 });
    setTimeout(() => {
      flip.value = 0; slide.value = 0;
      setRevealed(false);
      setIdx(i => i + 1);
    }, 230);
  };

  if (done) return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.center}>
        <Text style={s.doneTitle}>Pack complete</Text>
        <Text style={s.doneSub}>
          {newCount} new species in your journal{newCount < pack.length ? ` · ${pack.length - newCount} duplicates` : ''}
        </Text>
        <Pressable onPress={() => router.replace('/collection')} style={s.primary}>
          <Text style={s.primaryTxt}>View Journal</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/pack')} style={s.ghost}>
          <Text style={s.ghostTxt}>Open another pack</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/')} style={s.ghost}>
          <Text style={s.ghostTxt}>Home</Text>
        </Pressable>
      </View>
    </View>
  );

  const tc = TROPHIC_COLOR[card.trophic] || C.dim;
  const photo = photoFor(card.id, 480);

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.topRow}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <Text style={s.back}>‹ Home</Text>
        </Pressable>
        <View style={s.dots}>
          {pack.map((_, i) => (
            <View key={i} style={[s.dot, i === idx && s.dotOn, i < idx && s.dotDone]} />
          ))}
        </View>
      </View>

      <Pressable onPress={reveal} style={s.stage} disabled={revealed}>
        {/* face-down back */}
        <Animated.View style={[s.cardBox, s.cardBack, backStyle]}>
          <Text style={s.backHex}>⬡</Text>
          <Text style={s.backBrand}>Polygrove</Text>
          <Text style={s.tapHint}>tap to reveal</Text>
        </Animated.View>
        {/* revealed face */}
        <Animated.View style={[s.cardBox, { borderColor: tc }, faceStyle]}>
          {photo
            ? <Image source={{ uri: photo }} style={s.photo} resizeMode="cover" />
            : <View style={[s.photo, s.center]}><Text style={{ color: C.faint }}>—</Text></View>}
          <View style={{ padding: 16 }}>
            <Text style={s.name} numberOfLines={2}>{card.name}</Text>
            <Text style={s.sci} numberOfLines={1}>{card.sci}</Text>
            <View style={s.chipRow}>
              <Text style={[s.trophic, { color: tc }]}>{card.trophic}</Text>
              <Text style={s.group}> · {card.group}</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>

      <View style={{ minHeight: 64, justifyContent: 'center' }}>
        {revealed ? (
          <Pressable onPress={collect} style={s.primary}>
            <Text style={s.primaryTxt}>
              {owns(card.species_id) ? 'Already collected — next ›' : 'Add to Journal ›'}
            </Text>
          </Pressable>
        ) : (
          <Text style={s.cardNo}>card {idx + 1} of {pack.length}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#333' },
  dotOn: { width: 18, backgroundColor: C.greenSoft },
  dotDone: { backgroundColor: '#2E7D32' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardBox: {
    position: 'absolute', width: '92%', maxWidth: 360, aspectRatio: 0.68,
    borderRadius: 22, borderWidth: 2, backgroundColor: '#141414', overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    borderColor: '#2E7D32', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#101510',
  },
  backHex: { fontSize: 84, color: '#2E7D32', lineHeight: 96 },
  backBrand: { fontFamily: F.display, fontSize: 20, color: C.text, marginTop: 8 },
  tapHint: { fontFamily: F.sans, fontSize: 12, color: C.faint, marginTop: 16 },
  photo: { width: '100%', flex: 1, backgroundColor: '#181818' },
  name: { fontFamily: F.display, fontSize: 19, color: C.text, lineHeight: 25 },
  sci: { fontFamily: F.sans, fontStyle: 'italic', fontSize: 12.5, color: C.dim, marginTop: 3 },
  chipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  trophic: { fontFamily: F.sansBold, fontSize: 11.5 },
  group: { fontFamily: F.sansMed, fontSize: 11.5, color: C.faint },
  cardNo: { fontFamily: F.sans, fontSize: 12, color: C.faint, textAlign: 'center' },
  primary: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 13, borderRadius: 24,
    backgroundColor: '#2E7D32', minWidth: 220, alignItems: 'center',
  },
  primaryTxt: { fontFamily: F.sansBold, fontSize: 14.5, color: C.text },
  doneTitle: { fontFamily: F.display, fontSize: 26, color: C.text },
  doneSub: { fontFamily: F.sans, fontSize: 13, color: C.dim, marginBottom: 14 },
  ghost: { paddingVertical: 8 },
  ghostTxt: { fontFamily: F.sansMed, fontSize: 13.5, color: C.greenSoft },
});
