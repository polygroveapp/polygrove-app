// WHERE ARE YOU — pick the ecoregion you're in (2026-09-26). Apple Maps with
// every RESOLVE ecoregion outlined (the site's 2%-simplified geometry); tap a
// spot → point-in-polygon → the ecoregion lights up → Enter. 📍 uses your
// real location. The choice sets the deck the daily pack draws from.

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Geojson, MapPressEvent, Polygon, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../constants/polygrove';
import { loadCatalog } from '../lib/catalog';
import { ECO_GEOMETRY_URL, ecoDeckSize, loadCurrentEco, setCurrentEco, useCurrentEco } from '../lib/ecoregions';

type LatLng = { latitude: number; longitude: number };
type Feature = { properties: { eco: number; name: string }; geometry: { type: 'MultiPolygon' | 'Polygon'; coordinates: number[][][] | number[][][][] } };
type FC = { type: 'FeatureCollection'; features: Feature[] };
type Pick = { eid: number; name: string; rings: LatLng[][]; bbox: [number, number, number, number] };

let _geo: FC | null = null;
const loadGeo = () => _geo ? Promise.resolve(_geo) : fetch(ECO_GEOMETRY_URL).then(r => r.json()).then((g: FC) => {
  // eco 0 'Rock and Ice' is the polar mask — not a deck, and its ring circles
  // the pole, which MapKit draws as lines across the globe
  g.features = g.features.filter(f => f.properties.eco !== 0);
  return (_geo = unwrap(g));
});

// rings that cross the ±180° dateline (Bering tundra, Fiji…) would be drawn
// the long way round the globe by MapKit: shift their western half by +360
// so each ring is continuous (MapKit accepts longitudes past 180).
function unwrap(g: FC): FC {
  for (const f of g.features) {
    const polys = f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates as number[][][]]
      : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) for (const ring of poly) {
      let w = 180, e = -180;
      for (const pt of ring) {
        // MapKit's Mercator ends at ±85.05° and WRAPS anything beyond to the
        // opposite edge, drawing a line across the whole map — clamp
        if (pt[1] > 85) pt[1] = 85; else if (pt[1] < -85) pt[1] = -85;
        if (pt[0] < w) w = pt[0]; if (pt[0] > e) e = pt[0];
      }
      if (e - w > 180) for (const pt of ring) if (pt[0] < 0) pt[0] += 360;
    }
  }
  return g;
}

// outer rings of every polygon in the feature, as [lon,lat] arrays
const outerRings = (f: Feature): number[][][] =>
  f.geometry.type === 'Polygon'
    ? [(f.geometry.coordinates as number[][][])[0]]
    : (f.geometry.coordinates as number[][][][]).map(p => p[0]);

function rayCast(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// unwrapped dateline rings live in 180…360 — test the shifted longitude too
const inRing = (lon: number, lat: number, ring: number[][]) =>
  rayCast(lon, lat, ring) || (lon < 0 && rayCast(lon + 360, lat, ring));

function pickAt(geo: FC, lon: number, lat: number): Pick | null {
  for (const f of geo.features) {
    const rings = outerRings(f);
    if (!rings.some(r => inRing(lon, lat, r))) continue;
    let w = 180, s = 90, e = -180, n = -90;
    for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return {
      eid: f.properties.eco, name: f.properties.name,
      rings: rings.map(r => r.map(([x, y]) => ({ latitude: y, longitude: x }))),
      bbox: [w, s, e, n],
    };
  }
  return null;
}

const regionOf = (b: [number, number, number, number], pad = 1.3): Region => ({
  latitude: (b[1] + b[3]) / 2, longitude: (b[0] + b[2]) / 2,
  latitudeDelta: Math.max(0.5, (b[3] - b[1]) * pad), longitudeDelta: Math.max(0.5, (b[2] - b[0]) * pad),
});

export default function EcoMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = useCurrentEco();
  const map = useRef<MapView>(null);
  const [geo, setGeo] = useState<FC | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [locating, setLocating] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);

  useEffect(() => {
    loadCurrentEco();
    loadGeo().then(setGeo).catch(() => setErr('The map needs an internet connection the first time.'));
    loadCatalog().then(() => setCatalogReady(true)).catch(() => { /* deck sizes just stay unknown */ });
  }, []);

  const onPress = (e: MapPressEvent) => {
    if (!geo) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPick(pickAt(geo, longitude, latitude));
  };

  const locate = async () => {
    if (!geo) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErr('Location permission was declined — tap the map instead.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = pickAt(geo, pos.coords.longitude, pos.coords.latitude);
      setPick(p);
      if (p) map.current?.animateToRegion(regionOf(p.bbox), 600);
      else setErr('No ecoregion found at your location — tap the map instead.');
    } catch { setErr('Couldn’t get your location — tap the map instead.'); }
    finally { setLocating(false); }
  };

  const enter = async () => {
    if (!pick) return;
    await setCurrentEco({ eid: pick.eid, name: pick.name, bbox: pick.bbox, size: ecoDeckSize(pick.eid) });
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  if (Platform.OS === 'web') return (
    <View style={[s.root, s.center]}><Text style={s.msg}>The map needs the phone build (react-native-maps).</Text></View>
  );

  const initial = current ? regionOf(current.bbox) : { latitude: 25, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 };
  const size = pick && catalogReady ? ecoDeckSize(pick.eid) : null;

  return (
    <View style={s.root}>
      <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={initial} onPress={onPress}
        userInterfaceStyle="dark" showsUserLocation showsCompass={false} pitchEnabled={false} rotateEnabled={false}>
        {geo && (
          <Geojson geojson={geo as never} strokeColor="rgba(129,199,132,0.55)" fillColor="rgba(76,175,80,0.04)" strokeWidth={1} />
        )}
        {pick && pick.rings.map((r, i) => (
          <Polygon key={`${pick.eid}-${i}`} coordinates={r} fillColor="rgba(76,175,80,0.35)" strokeColor="#4CAF50" strokeWidth={2} />
        ))}
      </MapView>

      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={s.backBtn}>
          <Text style={s.back}>‹ Home</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title}>Where are you?</Text>
          <Text style={s.sub}>{geo ? 'tap the map to pick your ecoregion' : err ? 'map unavailable' : 'loading ecoregions…'}</Text>
        </View>
        <Pressable onPress={locate} disabled={!geo || locating} hitSlop={8} style={s.locBtn}>
          {locating ? <ActivityIndicator color={C.green} /> : <Text style={s.locTxt}>📍</Text>}
        </Pressable>
      </View>

      <View style={[s.sheet, { paddingBottom: insets.bottom + 14 }]}>
        {err && !pick ? (
          <Text style={s.msg}>{err}</Text>
        ) : pick ? (
          <>
            <Text style={s.ecoName}>{pick.name}</Text>
            <Text style={s.ecoMeta}>
              {size != null ? `${size.toLocaleString()} species in this deck` : 'ecoregion'}
              {current?.eid === pick.eid ? ' · you’re here now' : ''}
            </Text>
            <Pressable onPress={enter} style={s.enter}>
              <Text style={s.enterTxt}>{current?.eid === pick.eid ? 'Stay here' : 'Enter this ecoregion'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.msg}>
            {current ? `You’re in ${current.name}. Tap somewhere else to move.` : 'Tap where you are, or 📍 to use your location.'}
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f0a' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(10,15,10,0.85)' },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  titleWrap: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(10,15,10,0.85)', borderRadius: 14, paddingVertical: 6 },
  title: { fontFamily: F.display, fontSize: 15, color: C.text },
  sub: { fontFamily: F.sans, fontSize: 10.5, color: '#888' },
  locBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(10,15,10,0.85)', alignItems: 'center', justifyContent: 'center' },
  locTxt: { fontSize: 20 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: 'rgba(10,15,10,0.94)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: 'rgba(129,199,132,0.25)', alignItems: 'center', gap: 6,
  },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, paddingVertical: 6 },
  ecoName: { fontFamily: F.display, fontSize: 18, color: C.text, textAlign: 'center' },
  ecoMeta: { fontFamily: F.sans, fontSize: 12, color: '#8B5035', letterSpacing: 0.5 },
  enter: { marginTop: 8, paddingHorizontal: 30, paddingVertical: 13, borderRadius: 24, backgroundColor: '#2E7D32', minWidth: 240, alignItems: 'center' },
  enterTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
});
