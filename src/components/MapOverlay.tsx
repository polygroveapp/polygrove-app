// WHERE DO YOU WANT TO CAMP? (user, 2026-09-29; was "Where are you?") — pick the ecoregion you're in. The map IS the website's
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
// ALWAYS LOADED (user, 2026-09-29: "have the map always loaded so it doesn't
// have to load"): this is not a screen. It is mounted ONCE in the root layout,
// above the navigator, and merely shown while the route is /map — the WebView
// and its map stay alive behind Camp and About, so switching to the Map tab
// is instant. The /map route itself is an empty backdrop.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { openWeb } from '../lib/web';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Defs, Ellipse, LinearGradient as SvgLinear, Path, RadialGradient, Stop, Svg } from 'react-native-svg';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import BottomNav, { NAV_HEIGHT } from './BottomNav';
import { C, F, getLevel, MASTERY } from '../constants/polygrove';
import { loadMastery, scoreOf, useMastery } from '../lib/mastery';
import { loadSightings, niceDate, syncSightings, useSightings, useSightingsRun } from '../lib/sightings';
import { Spot, observation } from '../lib/inatPublic';
import { ecoregionAt } from '../lib/locate';
import { getCards, loadCatalog } from '../lib/catalog';
import { collectedEcoregions, loadCollection, owns, useCollection } from '../lib/collection';
import { cleanLead, ecoDeckSize, ecoMembers, ecoMeta, loadCurrentEco, loadEcoMeta, setCurrentEco, useCurrentEco, wikiUrl } from '../lib/ecoregions';

const PICKER_URL = 'https://polygrovedb.pages.dev/map';   // Pages serves map.html here
const HEADER_H = 62;   // the "Where are you?" bar, below the safe area
// the sheet is a FIXED height whatever it shows: the pin sits in the middle
// of the map above it, so a sheet that grew with its content would move the
// pin, change what's under it, and chase itself
const SHEET_H = 198;   // (222 left a band of nothing under the button — user, 2026-09-30 "why is there space here"; content hangs from the top, so the sheet only needs its tallest state: 2-line name + 2-line lead + button)
const TILT_REST = 9;   // degrees of lean at rest; motion adds or removes up to this much

type Pick = { eid: number; name: string; bbox: [number, number, number, number] };


export default function MapOverlay({ visible }: { visible: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const current = useCurrentEco();
  const web = useRef<WebView>(null);
  const [pageReady, setPageReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);      // what's under the pin
  // A TAPPED ✕ (user, 2026-10-05: "hover over an x and it shows a pop up of
  // the observation and if you click on it it goes to the card … with your
  // photo"): the page sends the observation ids under the finger; the first
  // is fetched from iNaturalist and shown in a small card over the map —
  // your photo, what it is, when and where, and what it is in the game.
  // Tapping that opens your card (in the ecoregion where you saw it), or the
  // preview of the card it could be.
  // THE LIST UNDER THE PIN (user, 2026-10-06: "the preview is to the left of
  // the − and + and it is a list of all the x's under the pin"): the page
  // sends the marks within reach of the pin as the map settles; each is
  // fetched from iNaturalist once (cached) and listed, nearest first, in a
  // strip beside the zoom buttons. Tapping a row opens its card or preview.
  type Under = { id: number; kind: number };
  const [under, setUnder] = useState<Under[]>([]);
  // ONE AT A TIME (user, 2026-10-06): the strip shows one sighting with ‹ › to
  // step through the rest under the pin
  const [underAt, setUnderAt] = useState(0);
  const [obsCache, setObsCache] = useState<Record<number, (Spot & { grade: string }) | null>>({});
  const fetching = useRef(new Set<number>());
  useEffect(() => {
    // the shown one and its neighbours are fetched ahead, so stepping is instant; the rest as you reach them
    const at = Math.min(underAt, Math.max(0, under.length - 1));
    for (const u of under.slice(Math.max(0, at - 1), at + 4)) {
      if (u.id in obsCache || fetching.current.has(u.id)) continue;
      fetching.current.add(u.id);
      observation(u.id).then(o => setObsCache(c => ({ ...c, [u.id]: o }))).catch(() => setObsCache(c => ({ ...c, [u.id]: null })))
        .finally(() => fetching.current.delete(u.id));
    }
  }, [under, underAt, obsCache]);
  // a tap on a ✕ puts those marks at the head of the list
  const onMark = (ids: number[], ok: number) => {
    if (!ids.length) return;
    setUnder(prev => [...ids.map(id => ({ id, kind: ok })), ...prev.filter(u => !ids.includes(u.id))]); setUnderAt(0);
  };
  const openObs = async (o: Spot & { grade: string }) => {
    const sci = o.sci?.toLowerCase();
    const card = sci ? getCards().find(c => c.sci.toLowerCase() === sci) : undefined;
    if (card) {
      let eid: number | null = null;
      if (o.lng != null && o.lat != null) { try { eid = await ecoregionAt(o.lng, o.lat); } catch { /* no outline: fall through */ } }
      if (eid != null && sightings.earned.some(e => e.eid === eid && e.speciesId === card.species_id)) { router.push({ pathname: '/preview', params: { kind: 'earned', key: `${eid}:${card.species_id}` } }); return; }
      if (eid != null && owns(eid, card.species_id)) { router.push({ pathname: '/gallery', params: { ids: card.id, start: '0' } }); return; }
      // a card, but not yours there (not confirmed, or not in that deck): the preview knows which
      if (eid != null && sightings.potential.some(p => p.key === `${card.species_id}@${eid}`)) { router.push({ pathname: '/preview', params: { kind: 'potential', key: `${card.species_id}@${eid}` } }); return; }
    } else if (sci && sightings.potential.some(p => p.key === sci)) { router.push({ pathname: '/preview', params: { kind: 'potential', key: sci } }); return; }
    if (sightings.waiting.some(w => w.obsId === o.id)) { router.push({ pathname: '/preview', params: { kind: 'waiting', key: String(o.id) } }); return; }
    openWeb(o.uri);   // nothing in the game for it yet: the observation itself
  };
  const [catalogReady, setCatalogReady] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const [collected, setCollected] = useState<number[]>([]);

  useEffect(() => {
    loadCurrentEco();
    loadCatalog().then(() => setCatalogReady(true)).catch(() => { /* deck sizes just stay unknown */ });
    loadEcoMeta().then(() => setMetaReady(true)).catch(() => { /* preview shows name only */ });
  }, []);
  // every time the map comes forward: the journal may have grown since
  useEffect(() => {
    if (visible) Promise.all([loadCollection(), loadMastery()]).then(() => setCollected(collectedEcoregions()));
  }, [visible]);

  // the app's chrome, so the page centres the pin (and fly-to) in the visible map
  const padTop = insets.top + 8 + HEADER_H;
  const padBottom = NAV_HEIGHT + insets.bottom + SHEET_H;
  const pinY = (padTop + (winH - padBottom)) / 2;

  // push the app's state into the page: current ecoregion (fly-to on first
  // show) + collected ecoregions (gold) + chrome padding
  const pushState = (fly: boolean) => {
    // camp = the ecoregion you are in (brown border). MASTERY COLOURS (user,
    // 2026-09-30): an ecoregion you've been to is outlined dark → bright
    // green by how far its deck is mastered — the mean tier of every card in
    // the deck (unjournaled cards count as nothing), 0..1 — and GOLD once
    // every card is Solar (completed: gold border + gold inside). Known once
    // the catalog has loaded.
    const top = MASTERY.length;   // 6: a card's level runs 0 (none) … 6 (Solar)
    const progress: Record<number, number> = {};
    if (catalogReady) for (const eid of collected) {
      const deck = ecoMembers(eid);
      if (!deck.length) continue;
      progress[eid] = deck.reduce((n, c) => n + getLevel(scoreOf(c.species_id)), 0) / (deck.length * top);
    }
    const completed = collected.filter(eid => (progress[eid] ?? 0) >= 1);
    const state = JSON.stringify({ current: current?.eid ?? null, camp: current?.eid ?? null, collected, completed, progress, fly, pad: { top: padTop, bottom: padBottom } });
    web.current?.injectJavaScript(`window.polygroveSetState && window.polygroveSetState(${state}); true;`);
  };
  // also when the page becomes ready: with no camp chosen yet nothing else
  // sends the padding, and the page would read the pin at the screen's centre
  const masteryVersion = useMastery();   // re-send when a quiz is won
  // YOUR SIGHTINGS as yellow ✕ marks (user, 2026-10-05): the spots go to the
  // page whenever they change; and when the map comes forward with an old
  // check (or none), your sightings are looked up again
  const sightings = useSightings();
  const run = useSightingsRun();
  const marks = sightings.marks, meId = sightings.me?.id, checkedAt = sightings.checkedAt;
  // THE MARKS GO OVER ONCE, NOT ONCE PER PAGE (2026-10-06: the phone locked up
  // — a full check saves after every page, each save was a new array, and
  // each array re-sent 12,000 ✕s through the bridge and rebuilt the layer).
  // While a check runs nothing is sent; when it ends, or when the list is
  // quiet for 4 s, the marks go once, and only if they actually changed.
  const sentMarks = useRef<string>('');
  useEffect(() => {
    if (!pageReady || run.busy) return;
    const t = setTimeout(() => {
      const json = JSON.stringify(marks ?? []);
      if (json === sentMarks.current) return;
      sentMarks.current = json;
      web.current?.injectJavaScript(`window.polygroveSetMarks && window.polygroveSetMarks(${json}); true;`);
    }, sentMarks.current ? 4000 : 0);   // the first send is immediate
    return () => clearTimeout(t);
  }, [pageReady, marks, run.busy]);
  useEffect(() => {
    if (!visible) return;
    loadSightings().then(() => { if (meId != null && Date.now() - checkedAt > 60 * 60 * 1000) syncSightings(); });   // an hour; a cheap probe unless something changed
  }, [visible, meId, checkedAt]);
  useEffect(() => { if (pageReady) pushState(false); }, [pageReady, collected, catalogReady, current?.eid, padTop, padBottom, masteryVersion]);   // eslint-disable-line react-hooks/exhaustive-deps
  // fly to your camp whenever it isn't the one the map last flew to — on
  // launch (whichever arrives last, the page's ready or the stored camp) and
  // again if the camp changed while the map sat behind another tab
  const flownTo = useRef<number | null>(null);
  useEffect(() => {
    if (pageReady && current && flownTo.current !== current.eid) { flownTo.current = current.eid; pushState(true); }
  }, [pageReady, current]);   // eslint-disable-line react-hooks/exhaustive-deps

  // THE PIN MOVES WITH THE DRAG (user, 2026-09-30; first built leaning
  // against it, then "flip the orientation"): sideways drags tip it around its
  // tip the way the world is going (rotateZ), up/down drags move it up and
  // down with a small fore-aft tip (rotateX, with perspective). The
  // page sends each frame's slide in pixels; a touch of smoothing turns that
  // into a velocity, a stiff spring follows it, and once the map stops a
  // looser spring lets it swing back upright with a little wobble.
  const leanZ = useSharedValue(0), leanX = useSharedValue(0);
  const vel = useRef({ x: 0, y: 0 });
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPan = (dx: number, dy: number) => {
    const v = vel.current;
    v.x = v.x * 0.55 + dx * 0.45; v.y = v.y * 0.55 + dy * 0.45;
    const follow = { damping: 16, stiffness: 260, mass: 0.5 };
    // 360° (user, 2026-10-05: "it's only up down right and left"): the drag
    // is ONE vector — its length sets how far the pin leans, its angle where.
    // The sideways share tips the pin around its tip (rotateZ); the fore-aft
    // share slides the ball up or down the needle. A diagonal drag does both
    // in proportion, so the pin leans along the drag, whatever its direction.
    // It goes WITH the world (user, 2026-09-30): drag right, it tips right;
    // drag down, the ball rides up the needle.
    const mag = Math.hypot(v.x, v.y);
    const lean = Math.min(mag * 0.8, 24);
    const ux = mag > 0.01 ? v.x / mag : 0, uy = mag > 0.01 ? -v.y / mag : 0;
    leanZ.value = withSpring(lean * ux * 0.75, follow);
    leanX.value = withSpring(lean * uy * 1.6, follow);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      v.x = 0; v.y = 0;
      const back = { damping: 7, stiffness: 150, mass: 0.7 };
      leanZ.value = withSpring(0, back); leanX.value = withSpring(0, back);
    }, 70);
  };
  // THE TIP NEVER MOVES (user, 2026-09-30: "the bottom of the pin stays in
  // place") — every motion pivots on it; up/down drags only tip the pin
  // fore-aft, they don't lift it
  const leanStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${leanZ.value}deg` }],
  }));
  // FORE-AFT IS FAKED IN 3D (user, 2026-09-30: "on the way up the red ball
  // needs to be covering the stick, the other way the stick needs to be more
  // shown"): a flat drawing tipped with a perspective transform can't do
  // that — ball and needle are coplanar. So they're two layers: tipping
  // toward you foreshortens the needle and slides the (bigger, nearer) ball
  // down over it; tipping away stretches the needle a little and shrinks
  // the ball back, so the stick shows
  // (user, 2026-09-30, second pass: "move the ball down the stick and don't
  // let the stick pop out when scrolling up, the opposite for scrolling
  // down") — scrolling UP: the ball slides down the needle, which keeps its
  // length, so the needle's top stays buried in the ball (it can slide at
  // most 6pt: the needle top sits 6.9pt below the ball's top). Scrolling
  // DOWN: the ball slides up and the needle stretches with it, so more stick
  // shows and no gap opens under the ball.
  const NEEDLE_TOP = 16.3;   // needle top → tip, in viewBox units (= points here)
  // MORE PRONOUNCED (user, 2026-09-30): the ball travels up to 12pt down the
  // needle (the needle shortens under it at 60% of the travel, so its top
  // stays buried) and up to 16pt up it, the needle stretching to follow
  const slide = (a: number) => {
    'worklet';   // called from the UI thread inside the animated styles
    return a >= 0 ? Math.min(12, 24 * Math.sin(a)) : -18 * Math.sin(-a);
  };
  const needleStyle = useAnimatedStyle(() => {
    const a = (leanX.value * Math.PI) / 180, d = slide(a);
    return { transform: [{ scaleY: d < 0 ? 1 - d / NEEDLE_TOP : 1 - (0.6 * d) / NEEDLE_TOP }] };
  });
  const ballStyle = useAnimatedStyle(() => {
    const a = (leanX.value * Math.PI) / 180;
    const k = a >= 0 ? 1 + 0.4 * Math.sin(a) : 1 - 0.25 * Math.sin(-a);
    return { transform: [{ translateY: slide(a) }, { scale: k }] };
  });
  // the ground shadow stays flat on the map and slides under the ball as the
  // pin leans (the ball hangs ~23pt above the tip) — the cue that makes the
  // pin read as a solid thing
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.5,
    transform: [{ translateX: 23 * Math.sin((leanZ.value * Math.PI) / 180) }, { translateY: 5 * Math.sin((leanX.value * Math.PI) / 180) }],
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; eid?: number | null; name?: string; bbox?: Pick['bbox']; dx?: number; dy?: number; ids?: unknown[]; ok?: number; marks?: unknown[] };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') setPageReady(true);
    if (m.type === 'center') setPick(m.eid != null && m.name && m.bbox ? { eid: m.eid, name: m.name, bbox: m.bbox } : null);
    if (m.type === 'pan' && typeof m.dx === 'number' && typeof m.dy === 'number') onPan(m.dx, m.dy);
    if (m.type === 'mark' && Array.isArray(m.ids)) onMark(m.ids.map(Number).filter(Boolean), Number(m.ok ?? 1));
    if (m.type === 'under' && Array.isArray(m.marks)) { setUnder((m.marks as { id: number; kind: number }[]).filter(u => u && Number.isFinite(u.id))); setUnderAt(0); }
  };

  // SUBTLE MOTION (user, 2026-09-29: "as much as the new Photos widget
  // feature, very subtle"): the map leans a few degrees with the phone and
  // settles back. The resting posture is a slow running average, so however
  // you hold the phone is "level"; only movement away from it shows.
  useEffect(() => {
    if (!visible || !pageReady) return;
    let sub: { remove: () => void } | null = null, live = true;
    let base: [number, number] | null = null, out: [number, number] = [TILT_REST, 0], sent: [number, number] = [-1, 0];
    const deg = (r: number) => (r * 180) / Math.PI, clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    DeviceMotion.isAvailableAsync().then(ok => {
      if (!ok || !live) return;   // simulators have no motion sensor
      DeviceMotion.setUpdateInterval(50);
      sub = DeviceMotion.addListener(m => {
        if (!m.rotation) return;
        const b = deg(m.rotation.beta), g = deg(m.rotation.gamma);
        base = base ? [base[0] + (b - base[0]) * 0.02, base[1] + (g - base[1]) * 0.02] : [b, g];
        // TONED DOWN BY TWO-THIRDS (user, 2026-10-05): a third of the tripled
        // cut from 2026-09-30 — pitch 1.1 → 0.37, bearing 0.9 → 0.3, with the
        // caps back to a gentle ±9° of pitch and ±5° of turn
        const pitch = clamp(TILT_REST + (b - base[0]) * 0.37, 0, TILT_REST * 2);
        const bearing = clamp((g - base[1]) * 0.3, -5, 5);
        out = [out[0] + (pitch - out[0]) * 0.25, out[1] + (bearing - out[1]) * 0.25];
        if (Math.abs(out[0] - sent[0]) < 0.15 && Math.abs(out[1] - sent[1]) < 0.15) return;
        sent = [out[0], out[1]];
        web.current?.injectJavaScript(`window.polygroveTilt && window.polygroveTilt(${out[0].toFixed(2)}, ${out[1].toFixed(2)}); true;`);
      });
    }).catch(() => {});
    return () => { live = false; sub?.remove(); };
  }, [visible, pageReady]);

  const zoom = (d: number) => web.current?.injectJavaScript(`window.polygroveZoom && window.polygroveZoom(${d}); true;`);

  const enter = async () => {
    if (!pick) return;
    const m = ecoMeta(pick.eid);
    flownTo.current = pick.eid;   // the pin is already on it — no fly-back on return
    await setCurrentEco({ eid: pick.eid, name: pick.name, bbox: pick.bbox, size: ecoDeckSize(pick.eid), lead: m?.lead, photo: m?.photo, wiki: m?.wiki });
    router.replace({ pathname: '/', params: { tab: '1' } });
  };

  const have = useCollection(pick?.eid).length;   // journaled there — "x / N species in deck" (user, 2026-10-05)
  if (Platform.OS === 'web') return null;
  const size = pick && catalogReady ? ecoDeckSize(pick.eid) : null;
  const meta = pick && metaReady ? ecoMeta(pick.eid) : undefined;
  const here = !!pick && current?.eid === pick.eid;
  const visited = !!pick && collected.includes(pick.eid);

  return (
    // hidden = transparent and untouchable, never unmounted
    <View style={[s.root, !visible && s.hidden]} pointerEvents={visible ? 'auto' : 'none'}>
      <WebView ref={web} source={{ uri: PICKER_URL }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0d0d0d' }}
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
         <View style={{ width: PIN_W, height: PIN_H + 3 }}>
          {/* the ground shadow: flat on the map, under the tip, NOT part of the
              rotating pin (user, 2026-09-30: "make the pin 3D") */}
          <Animated.View style={[{ position: 'absolute', left: (PIN_W - 36) / 2, top: PIN_H - 4, width: 36, height: 10 }, shadowStyle]}>
            <Svg width={36} height={10} viewBox="0 0 36 10">
              <Defs>
                <RadialGradient id="pinshade" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#000" stopOpacity="0.9" />
                  <Stop offset="0.55" stopColor="#000" stopOpacity="0.45" />
                  <Stop offset="1" stopColor="#000" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="18" cy="5" rx="17" ry="4.5" fill="url(#pinshade)" />
            </Svg>
          </Animated.View>
          {/* the round pushpin: a glossy RED ball on a steel needle (user,
              2026-09-28: red in the end — tried grey, black, yellow, gold,
              orange — smaller ball, smaller overall). 3D (user, 2026-09-30): a
              lit sphere with a terminator and bounce light, a tapered needle
              with a machined sheen, a collar where they meet */}
          <Animated.View style={[{ width: PIN_W, height: PIN_H + 3, transformOrigin: '50% 90%' }, leanStyle]}>
          {/* the needle, pivoting on its tip */}
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: PIN_W, height: PIN_H + 3, transformOrigin: '50% 90%' }, needleStyle]}>
          <Svg width={PIN_W} height={PIN_H + 3} viewBox="0 0 20 33">
            <Defs>
              {/* a MUTED red ball (user, 2026-09-29: brick rather than signal red) is the layer above */}
              <SvgLinear id="steel" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#7d858c" />
                <Stop offset="0.42" stopColor="#f2f5f7" />
                <Stop offset="0.6" stopColor="#c3c9ce" />
                <Stop offset="1" stopColor="#4f565c" />
              </SvgLinear>
              <SvgLinear id="collar" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#4a5056" />
                <Stop offset="0.5" stopColor="#b9c0c6" />
                <Stop offset="1" stopColor="#3b4146" />
              </SvgLinear>
            </Defs>
            <Path d="M8.8 13.4 L11.2 13.4 L10.25 29.7 L9.75 29.7 Z" fill="url(#steel)" />
            <Ellipse cx="10" cy="13.2" rx="2.3" ry="0.9" fill="url(#collar)" stroke="#2d3236" strokeWidth="0.35" />
          </Svg>
          </Animated.View>
          {/* the ball, drawn over the needle, scaling about its own centre */}
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: PIN_W, height: PIN_H + 3, transformOrigin: '50% 21%' }, ballStyle]}>
          <Svg width={PIN_W} height={PIN_H + 3} viewBox="0 0 20 33">
            <Defs>
              <RadialGradient id="ball2" cx="34%" cy="28%" r="72%">
                <Stop offset="0" stopColor="#eab0aa" />
                <Stop offset="0.3" stopColor="#c45c54" />
                <Stop offset="0.68" stopColor="#8e3430" />
                <Stop offset="1" stopColor="#3f1513" />
              </RadialGradient>
              <RadialGradient id="bounce2" cx="70%" cy="82%" r="45%">
                <Stop offset="0" stopColor="#ffb6a8" stopOpacity="0.22" />
                <Stop offset="1" stopColor="#ffb6a8" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="10" cy="7" r="6.5" fill="url(#ball2)" />
            <Circle cx="10" cy="7" r="6.5" fill="url(#bounce2)" />
            <Circle cx="10" cy="7" r="6.5" fill="none" stroke="#2f0f0e" strokeWidth="0.45" />
            <Ellipse cx="7.2" cy="4.1" rx="2.2" ry="1.35" fill="rgba(255,255,255,0.62)" transform="rotate(-28 7.2 4.1)" />
            <Circle cx="6.3" cy="3.4" r="0.7" fill="rgba(255,255,255,0.95)" />
          </Svg>
          </Animated.View>
          </Animated.View>
         </View>
        </View>
      )}

      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.titleWrap}>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Where do you want to camp?</Text>
          <Text style={s.sub}>{pageReady ? 'move the map under the pin 🏕️' : err ? 'map unavailable' : 'loading ecoregions…'}</Text>
        </View>
      </View>

      {/* zoom in / out (user, 2026-09-28) — zooms around the pin */}
      {/* bottom-right: − then + (plus outermost). The compass came and went
          the same day (user, 2026-09-29); the map stays north-up */}
      {pageReady && (
        <View style={[s.zoom, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }]}>
          <Pressable onPress={() => zoom(-1)} hitSlop={6} style={s.zoomBtn}><Text style={s.zoomTxt}>−</Text></Pressable>
          <Pressable onPress={() => zoom(1)} hitSlop={6} style={s.zoomBtn}><Text style={s.zoomTxt}>+</Text></Pressable>
        </View>
      )}


      {/* the ✕ mark under the pin, to the LEFT of − and +: one at a time, ‹ › for the others */}
      {under.length > 0 && (() => {
        const at = Math.min(underAt, under.length - 1), u = under[at];
        const o = obsCache[u.id];
        const sci = o?.sci?.toLowerCase();
        const card = sci ? getCards().find(c => c.sci.toLowerCase() === sci) : undefined;
        const color = u.kind === 0 ? '#5fe35a' : u.kind === 2 ? '#aaaaaa' : C.yellow;
        return (
          <View style={[s.underWrap, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }]} pointerEvents="box-none">
            <View style={s.under}>
              <Pressable onPress={() => setUnderAt(a => Math.max(0, a - 1))} disabled={at === 0} hitSlop={8} style={s.underArrow}>
                <Text style={[s.underArrowTxt, at === 0 && { opacity: 0.25 }]}>‹</Text>
              </Pressable>
              {/* no photo here (user, 2026-10-06): the strip changes with every settle of the
                  map, and a photo per settle was a steady drip of downloads while panning —
                  a colour dot for the kind, the name, and the card one tap away */}
              <Pressable onPress={() => o && openObs(o)} disabled={!o} style={s.underRow}>
                <View style={[s.underDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.underName} numberOfLines={1}>{o === undefined ? 'Loading…' : o === null ? 'Unavailable' : card?.name ?? o.name}</Text>
                  <Text style={[s.underMeta, { color }]} numberOfLines={1}>
                    {u.kind === 0 ? 'waiting' : u.kind === 2 ? 'potential' : 'confirmed'}{o?.date ? ` · ${niceDate(o.date)}` : ''}{under.length > 1 ? ` · ${at + 1}/${under.length}` : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => setUnderAt(a => Math.min(under.length - 1, a + 1))} disabled={at >= under.length - 1} hitSlop={8} style={s.underArrow}>
                <Text style={[s.underArrowTxt, at >= under.length - 1 && { opacity: 0.25 }]}>›</Text>
              </Pressable>
            </View>
          </View>
        );
      })()}

      {/* the preview sheet sits above the tab bar */}
      <View style={[s.sheet, { bottom: 0, height: SHEET_H + NAV_HEIGHT + insets.bottom, paddingBottom: NAV_HEIGHT + insets.bottom + 12 }]}>
        {err && !pick ? (
          <Text style={s.msg}>{err}</Text>
        ) : pick ? (
          <>
            {/* the preview opens the ecoregion's Wikipedia article (user, 2026-09-29) */}
            <Pressable style={s.preview}
              onPress={() => openWeb(wikiUrl(meta?.wiki ?? pick.name))}>
              {meta?.photo ? (
                <Image source={{ uri: meta.photo.thumb }} style={s.photo} contentFit="cover" transition={200} />
              ) : (
                <View style={[s.photo, s.center]}><Text style={s.noPhoto}>🌿</Text></View>
              )}
              <View style={s.previewText}>
                <Text style={s.ecoName} numberOfLines={2}>{pick.name}</Text>
                {/* one line always: the "here" note shortens the count rather than wrapping */}
                <Text style={s.ecoMeta} numberOfLines={1}>
                  {size != null ? `${have.toLocaleString()} / ${size.toLocaleString()} species in deck` : 'ecoregion'}{here ? ' · you’re here now' : ''}
                </Text>
                {meta?.lead ? <Text style={s.lead} numberOfLines={pick.name.length > 26 ? 2 : 3}>{cleanLead(meta.lead)}</Text> : null}
                <Text style={s.credit} numberOfLines={1}>
                  <Text style={s.wikiLink}>Wikipedia ›</Text>{meta?.photo?.by ? `  ·  photo ${meta.photo.by} (${meta.photo.lic})` : ''}
                </Text>
              </View>
            </Pressable>
            <Pressable onPress={enter} style={[s.enter, here && s.enterHere]}>
              <Text style={[s.enterTxt, here && s.enterTxtHere]}>{here ? 'Stay in ecoregion' : visited ? 'Return to ecoregion' : 'Explore ecoregion'}</Text>
            </Pressable>
          </>
        ) : (
          // NOTHING UNDER THE PIN (user, 2026-09-30, "look there's a space"): the
          // same shape as a preview — a picture box, a title, a line, a button —
          // so the sheet never looks half-empty; the button flies home
          <>
            <View style={s.preview}>
              <View style={[s.photo, s.center]}><Text style={s.noPhoto}>{pageReady ? '🌊' : '🗺️'}</Text></View>
              <View style={s.previewText}>
                <Text style={s.ecoName}>{pageReady ? 'No ecoregion here' : 'Loading the map…'}</Text>
                <Text style={s.lead}>
                  {pageReady ? 'Open water, ice or the edge of the map. Move the map until the pin sits on land.'
                    : current ? `You’re camped in ${current.name}.` : 'Choose where to camp once it loads.'}
                </Text>
              </View>
            </View>
            {current ? (
              <Pressable onPress={() => pushState(true)} style={[s.enter, s.enterHere]}>
                <Text style={[s.enterTxt, s.enterTxtHere]} numberOfLines={1}>Back to camp · {current.name}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
      <BottomNav active="map" shown={visible} />
    </View>
  );
}

const PIN_W = 20, PIN_H = 30;   // the pin body; the needle's tip (y=30 of the 33 viewBox) sits at pinY

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, backgroundColor: '#0d0d0d' },
  hidden: { opacity: 0 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  // no back button (user, 2026-09-29): the tab bar's Camp is the way home
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, gap: 10 },
  titleWrap: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(10,15,10,0.85)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  title: { fontFamily: F.display, fontSize: 15, color: '#ffe14d' },   // yellow (user, 2026-09-30 — after the ecoregion brown, white, dimmer white)
  sub: { fontFamily: F.sans, fontSize: 10.5, color: '#ffffff' },   // white (user, 2026-09-30; was grey)
  pin: { position: 'absolute', left: 0, right: 0, alignItems: 'center', height: PIN_H + 3 },
  zoom: { position: 'absolute', right: 14, gap: 8, flexDirection: 'row' },
  // the list of ✕ marks under the pin, left of the zoom buttons; its bottom lines up with theirs
  underWrap: { position: 'absolute', left: 14, right: 118, alignItems: 'flex-start', justifyContent: 'flex-end' },
  under: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 4, backgroundColor: 'rgba(10,15,10,0.9)', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  underRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  underDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 4 },
  underName: { fontFamily: F.sansBold, fontSize: 12.5, color: C.text },
  underMeta: { fontFamily: F.sans, fontSize: 10.5 },
  underArrow: { width: 26, height: 36, alignItems: 'center', justifyContent: 'center' },
  underArrowTxt: { fontFamily: F.sansBold, fontSize: 22, color: C.greenSoft, lineHeight: 26 },

  // the + / − green (user, 2026-09-30: brown for a minute, then "green again")
  zoomBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(10,15,10,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  zoomTxt: { fontFamily: F.sansBold, fontSize: 22, color: C.greenSoft, lineHeight: 26 },
  sheet: {
    position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    backgroundColor: 'rgba(10,15,10,0.94)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    // content hangs from the TOP padding: if it ever outgrows the sheet it
    // must not push the photo and name up onto the border (user, 2026-09-29)
    borderTopWidth: 1, borderColor: 'rgba(129,199,132,0.25)', gap: 10, justifyContent: 'flex-start', overflow: 'hidden',
  },
  preview: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  photo: { width: 108, height: 108, borderRadius: 14, backgroundColor: '#1c2a1c', borderWidth: 1, borderColor: 'rgba(129,199,132,0.3)' },
  noPhoto: { fontSize: 30 },
  previewText: { flex: 1, gap: 3, minHeight: 108, justifyContent: 'center' },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, paddingVertical: 6, paddingHorizontal: 12 },
  ecoName: { fontFamily: F.display, fontSize: 16, color: C.text, lineHeight: 20 },
  // the header's ecoregion-name brown, and its weight — the regular weight read darker (user, 2026-09-29)
  ecoMeta: { fontFamily: F.sansBold, fontSize: 11.5, color: '#8B5035', letterSpacing: 0.6 },
  lead: { fontFamily: F.sans, fontSize: 12, color: '#c9c4b8', lineHeight: 16.5, marginTop: 2 },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#666', marginTop: 2 },
  wikiLink: { fontFamily: F.sansBold, color: C.greenSoft },
  enter: { paddingVertical: 12, borderRadius: 24, backgroundColor: '#2E7D32', alignItems: 'center' },
  // "Stay in ecoregion" (and Back to camp) in the camp's YELLOW (user, 2026-09-30; was a quiet dark green)
  enterHere: { backgroundColor: '#4CAF50' },   // GREEN (user, 2026-10-05), the map's own green for where you are; orange and yellow before
  enterTxtHere: { color: '#1a1a1a' },
  enterTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
});
