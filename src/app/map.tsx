// WHERE ARE YOU — pick the ecoregion you're in. The map IS the website's
// Ecoregions-page map (user, 2026-09-28): the site serves it as a standalone
// MapLibre page (explorer/map.html — black land, blue water, terrain relief,
// green ecoregion borders, glowing green selection, green names) and the app
// embeds it in a WebView, same on iOS and Android. MapLibre Native would need
// a development build; this runs in Expo Go today and can be swapped later.
// PIN PICKING (user, 2026-09-28): a fixed pin sits in the middle of the
// visible map; you pan the world under it (or tap to slide a spot under it)
// and the sheet previews the ecoregion under the pin — its Wikipedia photo
// and first sentence (eco_meta.json) — with the Enter button (Stay in /
// Return to / Explore, by whether it's yours / visited / new). Visited
// ecoregions are outlined in a stronger green on the map.
// Bridge: page → {ready | center{eid|null,name,bbox}}; app → {state{current,collected,fly,pad}}.
// NO LOCATION (user, 2026-09-28): the app never reads the device's location
// and nothing about where the pin goes leaves the phone — the page is ours,
// static, and only ever talks to this WebView.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Defs, Ellipse, Path, RadialGradient, Stop, Svg } from 'react-native-svg';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import BottomNav, { NAV_HEIGHT } from '../components/BottomNav';
import { C, F } from '../constants/polygrove';
import { loadCatalog } from '../lib/catalog';
import { collectedEcoregions, loadCollection } from '../lib/collection';
import { ecoDeckSize, ecoMeta, loadCurrentEco, loadEcoMeta, setCurrentEco, useCurrentEco } from '../lib/ecoregions';

const PICKER_URL = 'https://polygrovedb.pages.dev/map';   // Pages serves map.html here
const HEADER_H = 62;   // the "Where are you?" bar, below the safe area
// the sheet is a FIXED height whatever it shows: the pin sits in the middle
// of the map above it, so a sheet that grew with its content would move the
// pin, change what's under it, and chase itself
const SHEET_H = 206;

type Pick = { eid: number; name: string; bbox: [number, number, number, number] };

// the dump-extracted leads carry pronunciation stubs like "( ; coast, shore)"
const cleanLead = (t: string) => t.replace(/\s*\(\s*;[^)]*\)/g, '').replace(/\s*\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

export default function EcoMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const current = useCurrentEco();
  const web = useRef<WebView>(null);
  const [pageReady, setPageReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);      // what's under the pin
  const [catalogReady, setCatalogReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const [collected, setCollected] = useState<number[]>([]);

  useEffect(() => {
    loadCurrentEco();
    loadCollection().then(() => setCollected(collectedEcoregions()));
    loadCatalog().then(() => setCatalogReady(true)).catch(() => { /* deck sizes just stay unknown */ });
    loadEcoMeta().then(() => setMetaReady(true)).catch(() => { /* preview shows name only */ });
  }, []);

  // the app's chrome, so the page centres the pin (and fly-to) in the visible map
  const padTop = insets.top + 8 + HEADER_H;
  const padBottom = NAV_HEIGHT + insets.bottom + SHEET_H;
  const pinY = (padTop + (winH - padBottom)) / 2;

  // push the app's state into the page: current ecoregion (fly-to on first
  // show) + collected ecoregions (gold) + chrome padding
  const pushState = (fly: boolean) => {
    const state = JSON.stringify({ current: current?.eid ?? null, collected, fly, pad: { top: padTop, bottom: padBottom } });
    web.current?.injectJavaScript(`window.polygroveSetState && window.polygroveSetState(${state}); true;`);
  };
  useEffect(() => { if (pageReady) pushState(false); }, [collected, padTop, padBottom]);   // eslint-disable-line react-hooks/exhaustive-deps
  // fly to your ecoregion once, whichever arrives last: the page's ready or
  // the stored ecoregion (a cold start can read storage after the page loads)
  const flown = useRef(false);
  useEffect(() => {
    if (pageReady && current && !flown.current) { flown.current = true; pushState(true); }
  }, [pageReady, current]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; eid?: number | null; name?: string; bbox?: Pick['bbox'] };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') setPageReady(true);
    if (m.type === 'center') setPick(m.eid != null && m.name && m.bbox ? { eid: m.eid, name: m.name, bbox: m.bbox } : null);
  };

  const zoom = (d: number) => web.current?.injectJavaScript(`window.polygroveZoom && window.polygroveZoom(${d}); true;`);

  const enter = async () => {
    if (!pick) return;
    await setCurrentEco({ eid: pick.eid, name: pick.name, bbox: pick.bbox, size: ecoDeckSize(pick.eid) });
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  if (Platform.OS === 'web') return (
    <View style={[s.root, s.center]}><Text style={s.msg}>Open the map on the phone.</Text></View>
  );
  const size = pick && catalogReady ? ecoDeckSize(pick.eid) : null;
  const meta = pick && metaReady ? ecoMeta(pick.eid) : undefined;
  const here = !!pick && current?.eid === pick.eid;
  const visited = !!pick && collected.includes(pick.eid);

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

      {/* the pin — a classic red map pin (user, 2026-09-28); its tip is the point the page reads */}
      {pageReady && (
        <View style={[s.pin, { top: pinY - PIN_H }]} pointerEvents="none">
          {/* the round pushpin: glossy red ball on a thin steel needle, like 📍 */}
          <Svg width={PIN_W} height={PIN_H + 4} viewBox="0 0 32 48">
            <Defs>
              <RadialGradient id="ball" cx="38%" cy="32%" r="65%">
                <Stop offset="0" stopColor="#ff8a80" />
                <Stop offset="0.45" stopColor="#e53935" />
                <Stop offset="1" stopColor="#8e1b1b" />
              </RadialGradient>
            </Defs>
            <Ellipse cx="16" cy="45.5" rx="5" ry="2" fill="rgba(0,0,0,0.45)" />
            <Path d="M15.2 22 L16.8 22 L16.4 44 L15.6 44 Z" fill="#cfd4d8" stroke="#6b7278" strokeWidth="0.6" />
            <Circle cx="16" cy="12" r="11" fill="url(#ball)" stroke="#7a1414" strokeWidth="0.8" />
            <Ellipse cx="11.5" cy="7.5" rx="3.2" ry="2" fill="rgba(255,255,255,0.7)" />
          </Svg>
        </View>
      )}

      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={s.backBtn}>
          <Text style={s.back}>‹ Home</Text>
        </Pressable>
        <View style={s.titleWrap}>
          <Text style={s.title}>Where are you?</Text>
          <Text style={s.sub}>{pageReady ? 'move the map under the pin' : err ? 'map unavailable' : 'loading ecoregions…'}</Text>
        </View>
        <View style={s.spacer} />
      </View>

      {/* zoom in / out (user, 2026-09-28) — zooms around the pin */}
      {pageReady && (
        <View style={[s.zoom, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }]}>
          <Pressable onPress={() => zoom(1)} hitSlop={6} style={s.zoomBtn}><Text style={s.zoomTxt}>+</Text></Pressable>
          <Pressable onPress={() => zoom(-1)} hitSlop={6} style={s.zoomBtn}><Text style={s.zoomTxt}>−</Text></Pressable>
        </View>
      )}

      {/* the preview sheet sits above the tab bar */}
      <View style={[s.sheet, { bottom: 0, height: SHEET_H + NAV_HEIGHT + insets.bottom, paddingBottom: NAV_HEIGHT + insets.bottom + 12 }]}>
        {err && !pick ? (
          <Text style={s.msg}>{err}</Text>
        ) : pick ? (
          <>
            <View style={s.preview}>
              {meta?.photo ? (
                <Image source={{ uri: meta.photo.thumb }} style={s.photo} contentFit="cover" transition={200} />
              ) : (
                <View style={[s.photo, s.center]}><Text style={s.noPhoto}>🌿</Text></View>
              )}
              <View style={s.previewText}>
                <Text style={s.ecoName} numberOfLines={2}>{pick.name}</Text>
                <Text style={s.ecoMeta}>
                  {size != null ? `${size.toLocaleString()} species in this deck` : 'ecoregion'}{here ? ' · you’re here now' : ''}
                </Text>
                {meta?.lead ? <Text style={s.lead} numberOfLines={3}>{cleanLead(meta.lead)}</Text> : null}
                {meta?.photo?.by ? <Text style={s.credit} numberOfLines={1}>Wikipedia · photo {meta.photo.by} ({meta.photo.lic})</Text> : null}
              </View>
            </View>
            <Pressable onPress={enter} style={[s.enter, here && s.enterHere]}>
              <Text style={s.enterTxt}>{here ? 'Stay in ecoregion' : visited ? 'Return to ecoregion' : 'Explore ecoregion'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.msg}>
            {pageReady ? 'Move the map until the pin sits on an ecoregion.' : current ? `You’re in ${current.name}.` : 'Loading the map…'}
          </Text>
        )}
      </View>
      <BottomNav active="map" />
    </View>
  );
}

const PIN_W = 32, PIN_H = 44;   // the pin body; the needle's tip (y=44 of the 48 viewBox) sits at pinY

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1a29' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(10,15,10,0.85)' },
  back: { fontFamily: F.sansBold, fontSize: 14, color: C.greenSoft },
  titleWrap: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(10,15,10,0.85)', borderRadius: 14, paddingVertical: 6 },
  title: { fontFamily: F.display, fontSize: 15, color: C.text },
  sub: { fontFamily: F.sans, fontSize: 10.5, color: '#888' },
  spacer: { width: 42 },   // balances the Home button so the title stays centred
  pin: { position: 'absolute', left: 0, right: 0, alignItems: 'center', height: PIN_H + 4 },
  zoom: { position: 'absolute', right: 14, gap: 8 },
  zoomBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(10,15,10,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  zoomTxt: { fontFamily: F.sansBold, fontSize: 22, color: C.greenSoft, lineHeight: 26 },
  sheet: {
    position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: 'rgba(10,15,10,0.94)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: 'rgba(129,199,132,0.25)', gap: 10, justifyContent: 'center',
  },
  preview: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  photo: { width: 108, height: 108, borderRadius: 14, backgroundColor: '#1c2a1c', borderWidth: 1, borderColor: 'rgba(129,199,132,0.3)' },
  noPhoto: { fontSize: 30 },
  previewText: { flex: 1, gap: 3, minHeight: 108, justifyContent: 'center' },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, paddingVertical: 6, paddingHorizontal: 12 },
  ecoName: { fontFamily: F.display, fontSize: 16, color: C.text, lineHeight: 20 },
  ecoMeta: { fontFamily: F.sans, fontSize: 11.5, color: '#8B5035', letterSpacing: 0.4 },
  lead: { fontFamily: F.sans, fontSize: 12, color: '#c9c4b8', lineHeight: 16.5, marginTop: 2 },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#666', marginTop: 2 },
  enter: { paddingVertical: 12, borderRadius: 24, backgroundColor: '#2E7D32', alignItems: 'center' },
  enterHere: { backgroundColor: '#1f3a22', borderWidth: 1, borderColor: 'rgba(129,199,132,0.35)' },
  enterTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
});
