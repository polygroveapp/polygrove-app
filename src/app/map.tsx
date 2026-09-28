// WHERE ARE YOU — pick the ecoregion you're in. The map IS the website's
// Ecoregions-page map (user, 2026-09-28): the site serves it as a standalone
// MapLibre page (explorer/map.html — black land, blue water, terrain relief,
// green ecoregion borders, glowing green selection, green names) and the app
// embeds it in a WebView, same on iOS and Android. MapLibre Native would need
// a development build; this runs in Expo Go today and can be swapped later.
// Bridge: page → {ready | pick{eid,name,bbox}}; app → {state{current,collected}}.
// 📍 uses the real location, resolved against the site's geometry here.

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import { C, F } from '../constants/polygrove';
import { loadCatalog } from '../lib/catalog';
import { collectedEcoregions, loadCollection } from '../lib/collection';
import { ECO_GEOMETRY_URL, ecoDeckSize, loadCurrentEco, setCurrentEco, useCurrentEco } from '../lib/ecoregions';

const PICKER_URL = 'https://polygrovedb.pages.dev/map';   // Pages serves map.html here

type Feature = { properties: { eco: number; name: string }; geometry: { type: 'MultiPolygon' | 'Polygon'; coordinates: number[][][] | number[][][][] } };
type FC = { type: 'FeatureCollection'; features: Feature[] };
type Pick = { eid: number; name: string; bbox: [number, number, number, number] };

// geometry is only needed on the phone for 📍 (point-in-polygon); the map
// itself lives in the page
let _geo: FC | null = null;
const loadGeo = () => _geo ? Promise.resolve(_geo) : fetch(ECO_GEOMETRY_URL).then(r => r.json()).then((g: FC) => (_geo = g));
const outerRings = (f: Feature): number[][][] =>
  f.geometry.type === 'Polygon' ? [(f.geometry.coordinates as number[][][])[0]] : (f.geometry.coordinates as number[][][][]).map(p => p[0]);
function rayCast(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pickAt(geo: FC, lon: number, lat: number): Pick | null {
  for (const f of geo.features) {
    const rings = outerRings(f);
    if (!rings.some(r => rayCast(lon, lat, r))) continue;
    let w = 180, s = 90, e = -180, n = -90;
    for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return { eid: f.properties.eco, name: f.properties.name, bbox: [w, s, e, n] };
  }
  return null;
}

export default function EcoMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = useCurrentEco();
  const web = useRef<WebView>(null);
  const [pageReady, setPageReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [locating, setLocating] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [collected, setCollected] = useState<number[]>([]);

  useEffect(() => {
    loadCurrentEco();
    loadCollection().then(() => setCollected(collectedEcoregions()));
    loadCatalog().then(() => setCatalogReady(true)).catch(() => { /* deck sizes just stay unknown */ });
  }, []);

  // push the app's state into the page: current ecoregion (glow, fly-to on
  // first show) + collected ecoregions (gold)
  const pushState = (fly: boolean) => {
    const state = JSON.stringify({ current: (pick ?? current)?.eid ?? null, collected, fly });
    web.current?.injectJavaScript(`window.polygroveSetState && window.polygroveSetState(${state}); true;`);
  };
  useEffect(() => { if (pageReady) pushState(false); }, [collected, pick]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; eid?: number; name?: string; bbox?: Pick['bbox'] };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') { setPageReady(true); setTimeout(() => pushState(true), 50); }
    if (m.type === 'pick' && m.eid != null && m.name && m.bbox) setPick({ eid: m.eid, name: m.name, bbox: m.bbox });
  };

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErr('Location permission was declined — tap the map instead.'); return; }
      const [geo, pos] = await Promise.all([loadGeo(), Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })]);
      const p = pickAt(geo, pos.coords.longitude, pos.coords.latitude);
      if (p) {
        setPick(p);
        const state = JSON.stringify({ current: p.eid, fly: true });
        web.current?.injectJavaScript(`window.polygroveSetState && window.polygroveSetState(${state}); true;`);
      } else setErr('No ecoregion found at your location — tap the map instead.');
    } catch { setErr('Couldn’t get your location — tap the map instead.'); }
    finally { setLocating(false); }
  };

  const enter = async () => {
    if (!pick) return;
    await setCurrentEco({ eid: pick.eid, name: pick.name, bbox: pick.bbox, size: ecoDeckSize(pick.eid) });
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  if (Platform.OS === 'web') return (
    <View style={[s.root, s.center]}><Text style={s.msg}>Open the map on the phone.</Text></View>
  );
  const size = pick && catalogReady ? ecoDeckSize(pick.eid) : null;

  return (
    <View style={s.root}>
      <WebView ref={web} source={{ uri: PICKER_URL }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0b1a29' }}
        onMessage={onMessage} onError={() => setErr('The map needs an internet connection.')}
        javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback bounces={false} overScrollMode="never"
        setBuiltInZoomControls={false} scalesPageToFit={false} originWhitelist={['https://*']} />
      {!pageReady && !err && (
        <View style={[s.center, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]} pointerEvents="none">
          <ActivityIndicator color={C.green} />
        </View>
      )}

      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={s.backBtn}>
          <Text style={s.back}>‹ Home</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title}>Where are you?</Text>
          <Text style={s.sub}>{pageReady ? 'tap the map to pick your ecoregion' : err ? 'map unavailable' : 'loading ecoregions…'}</Text>
        </View>
        <Pressable onPress={locate} disabled={!pageReady || locating} hitSlop={8} style={s.locBtn}>
          {locating ? <ActivityIndicator color={C.green} /> : <Text style={s.locTxt}>📍</Text>}
        </Pressable>
      </View>

      {/* the sheet sits above the tab bar */}
      <View style={[s.sheet, { bottom: NAV_HEIGHT + insets.bottom, paddingBottom: 14 }]}>
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
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><BottomNav active="map" /></View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1a29' },
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
    position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: 'rgba(10,15,10,0.94)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: 'rgba(129,199,132,0.25)', alignItems: 'center', gap: 6,
  },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, paddingVertical: 6 },
  ecoName: { fontFamily: F.display, fontSize: 18, color: C.text, textAlign: 'center' },
  ecoMeta: { fontFamily: F.sans, fontSize: 12, color: '#8B5035', letterSpacing: 0.5 },
  enter: { marginTop: 8, paddingHorizontal: 30, paddingVertical: 13, borderRadius: 24, backgroundColor: '#2E7D32', minWidth: 240, alignItems: 'center' },
  enterTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
});
