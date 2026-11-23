// WHERE DO YOU WANT TO CAMP? (user, 2026-09-29; was "Where are you?") — pick the ecoregion you're in. The map IS the website's
// Ecoregions-page map (user, 2026-09-28): the site serves it as a standalone
// MapLibre page (explorer/map.html — black land, blue water, terrain relief,
// green ecoregion borders, glowing green selection, green names) and the app
// embeds it in a WebView, same on iOS and Android. MapLibre Native would need
// a development build; this runs in Expo Go today and can be swapped later.
// PIN PICKING (user, 2026-09-28): a fixed pin sits in the middle of the
// visible map; you pan the world under it (or tap to slide a spot under it)
// and the sheet previews the ecoregion under the pin — its Wikipedia photo
// and first sentence (eco_meta.json) — with the Enter button ("Camp here", always, since 2026-11-16; it was Stay in /
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

import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { openWeb } from '../lib/web';
import { setBorders, setEarthColours, setPinDraw, setShowObs, useBorders, useEarthColours, usePinDraw, useShowObs } from '../lib/mapLook';
import { useEffect, useRef, useState, useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown, FadeOutUp, withTiming, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Defs, Ellipse, LinearGradient as SvgLinear, Path, RadialGradient, Stop, Svg } from 'react-native-svg';
import { WebFrame as WebView, type FrameMessage, type WebFrameRef } from './WebFrame';
import BottomNav, { NAV_HEIGHT } from './BottomNav';
import ObsTimeline, { hasTimeline, PLAY_FLY_MS } from './ObsTimeline';
import { BTN_BG, BTN_BORDER, C, F, getLevel, MASTERY } from '../constants/polygrove';
import { loadMastery, scoreOf, useMastery } from '../lib/mastery';
import { loadSightings, niceDate, smallPhoto, syncSightings, useSightings, useSightingsRun } from '../lib/sightings';
import { getPin, setPin } from '../lib/pin';
import { Spot, observation } from '../lib/inatPublic';
import { ecoregionAt } from '../lib/locate';
import { getCards, loadCatalog, photoFor } from '../lib/catalog';
import { collectedEcoregions, loadCollection, owns, useCollection } from '../lib/collection';
import { cleanLead, ecoDeckSize, ecoMembers, ecoMeta, loadCurrentEco, loadEcoMeta, setCurrentEco, useCurrentEco, wikiUrl } from '../lib/ecoregions';
import { DB_SITE } from '../constants/site';

const PICKER_URL = `${DB_SITE}/map`;   // Pages serves map.html here
const HEADER_H = 62;   // the "Where are you?" bar, below the safe area
// the sheet is a FIXED height whatever it shows: the pin sits in the middle
// of the map above it, so a sheet that grew with its content would move the
// pin, change what's under it, and chase itself
const SHEET_H = 198;   // (222 left a band of nothing under the button — user, 2026-09-30 "why is there space here"; content hangs from the top, so the sheet only needs its tallest state: 2-line name + 2-line lead + button)

type Pick = { eid: number; name: string; bbox: [number, number, number, number] };


// THE AMERICAS (user, 2026-10-07): the icon for the earth-colours button — the
// continents' real coastline traced from data/eco_simple.geojson (polygrovedb
// scratch script americas.py: rasterised, closed, largest landmass, boundary
// walked, simplified, one Chaikin pass), in a 24 × 32 box
const AMERICAS = 'M15.8 1.5 L20.3 1.5 L22.5 1.7 L22.5 2.1 L21.5 2.4 L19.5 2.4 L18.5 2.4 L18.5 2.6 L18.3 2.7 L17.9 2.7 L17.7 2.8 L17.7 3.2 L17.6 3.4 L17.5 3.5 L17.2 3.5 L16.8 3.5 L16.5 3.4 L16.4 3.1 L16.2 3.1 L15.9 3.1 L16.0 3.3 L16.4 3.7 L16.9 3.9 L17.3 4.0 L17.6 4.1 L17.6 4.4 L17.8 4.5 L18.2 4.6 L18.4 4.9 L18.4 5.4 L18.3 5.6 L18.1 5.6 L18.0 5.8 L17.9 6.0 L18.0 6.4 L18.4 6.9 L18.7 7.2 L19.1 7.4 L19.4 8.0 L19.6 8.9 L19.4 9.4 L18.9 9.4 L18.7 9.5 L18.7 9.7 L18.5 9.8 L18.2 10.0 L17.8 10.1 L17.3 10.1 L17.1 10.2 L17.1 10.5 L17.0 10.6 L16.7 10.6 L16.5 10.7 L16.4 11.0 L16.3 11.3 L16.3 11.7 L16.1 12.0 L15.7 12.3 L15.5 12.8 L15.6 13.5 L16.1 14.0 L17.0 14.4 L17.4 14.7 L17.4 15.2 L16.9 15.4 L15.9 15.5 L15.3 15.3 L15.2 14.9 L15.0 14.7 L14.7 14.7 L14.5 14.8 L14.5 15.1 L14.7 15.2 L15.0 15.3 L15.2 15.7 L15.2 16.2 L15.3 16.5 L15.5 16.5 L15.8 16.3 L16.0 16.0 L16.3 15.9 L16.7 15.9 L17.1 16.0 L17.4 16.2 L17.6 16.1 L17.7 15.6 L17.9 15.4 L18.3 15.4 L18.5 15.7 L18.5 16.3 L18.8 16.8 L19.5 17.2 L19.9 17.6 L20.0 18.2 L20.7 18.7 L21.8 19.2 L22.3 19.9 L22.3 20.7 L22.2 21.3 L21.9 21.6 L21.7 22.2 L21.6 23.1 L21.2 23.8 L20.6 24.2 L20.3 24.6 L20.3 24.9 L20.1 25.4 L19.8 25.9 L19.5 26.2 L19.3 26.2 L19.1 26.4 L19.0 26.8 L18.7 27.2 L18.2 27.4 L17.8 27.9 L17.8 28.7 L17.6 29.1 L17.5 29.2 L17.5 29.5 L17.6 30.2 L17.3 30.5 L16.5 30.4 L16.0 30.1 L15.8 29.7 L15.9 27.8 L16.3 24.5 L16.2 22.6 L15.7 22.3 L15.3 21.7 L15.0 20.9 L14.9 20.0 L14.9 19.0 L15.0 18.3 L15.2 17.9 L15.0 17.5 L14.4 17.3 L14.0 17.0 L13.9 16.6 L13.4 16.2 L12.4 15.9 L11.7 15.6 L11.4 15.3 L11.2 15.0 L11.1 14.6 L10.8 14.3 L10.3 14.1 L9.9 13.6 L9.6 12.7 L9.3 12.2 L9.0 12.1 L8.7 11.8 L8.5 11.3 L8.3 10.6 L8.3 9.6 L8.2 9.0 L7.9 8.9 L7.7 8.6 L7.6 8.3 L7.4 8.1 L7.2 8.1 L7.1 8.0 L7.1 7.6 L7.0 7.5 L6.8 7.5 L6.7 7.3 L6.6 7.1 L6.1 6.9 L5.2 6.8 L4.7 7.0 L4.7 7.3 L4.1 7.6 L2.9 7.8 L2.3 7.7 L2.3 7.3 L2.4 7.0 L2.7 6.9 L2.6 6.8 L2.2 6.8 L2.0 6.6 L2.0 6.3 L1.9 6.1 L1.6 6.1 L1.5 5.8 L1.5 5.2 L1.6 4.8 L1.9 4.8 L2.0 4.7 L2.0 4.5 L2.1 4.2 L2.5 4.1 L4.0 4.0 L6.8 4.0 L8.3 3.7 L8.5 3.0 L9.0 2.6 L9.7 2.4 L10.4 2.4 L10.9 2.4 L11.2 2.4 L11.3 2.6 L11.4 2.6 L11.4 2.3 L11.6 2.2 L12.2 2.2 L12.5 2.1 L12.5 1.9 L12.8 1.8 L13.3 1.6 Z';

// an ecoregion-shaped blob for the borders button, in a 24 × 24 box
const ECOBLOB = 'M5 7.5 C6 4.5 10 3 13.5 4.2 C16.5 5.2 20.5 6 20 10 C19.6 13 17 13.5 17.5 16.5 C18 19.5 14.5 21 11.5 20.2 C8.5 19.4 3.8 18.5 3.6 14.5 C3.4 11.5 4.2 10 5 7.5 Z';

// the tab bar's liquid glass as a round tile (user, 2026-10-07): frosted, and
// when on, the green-glass thumb with its top shine
function GlassTile({ on, onPress, label, children }: { on: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const tileInner = (
    <>
      {on && <LinearGradient colors={['rgba(129,199,132,0.38)', 'rgba(76,175,80,0.16)', 'rgba(255,255,255,0.08)']}
        locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      {on && <View style={s.lookShine} />}
      {children}
    </>
  );
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} android_ripple={{ color: 'rgba(129,199,132,0.25)', borderless: true, radius: 21 }}>
      {/* ANDROID: a plain dark-glass tile — expo-blur cannot sample the map WebView's
          surface there and costs frames; iOS gets the real frosted blur */}
      {Platform.OS === 'ios'
        ? <BlurView intensity={28} tint="dark" style={[s.lookBtn, on && s.lookBtnOn]}>{tileInner}</BlurView>
        : <View style={[s.lookBtn, on && s.lookBtnOn]}>{tileInner}</View>}
    </Pressable>
  );
}

export default function MapOverlay({ visible }: { visible: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const current = useCurrentEco();
  const web = useRef<WebFrameRef>(null);
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
  type Under = { id: number; kind: number; name?: string | null; sci?: string | null; date?: string | null; lng?: number | null; lat?: number | null };
  const [under, setUnder] = useState<Under[]>([]);
  // ONE AT A TIME (user, 2026-10-06): the strip shows one sighting with ‹ › to
  // step through the rest under the pin
  const [underAt, setUnderAt] = useState(0);
  // the timeline's play button (declared here because the strip's lookups below go quiet while it plays)
  const [playWanted, setPlaying] = useState(false);
  const [obsCache, setObsCache] = useState<Record<number, (Spot & { grade: string }) | null>>({});
  // the ✕ sighting marks on or off (user, 2026-10-07: "an x button to turn off
  // observations") — a remembered preference in the map preferences; an
  // earlier top-bar toggle lived for an hour on 2026-10-06
  const showObs = useShowObs();
  const pinDraw = usePinDraw();
  useEffect(() => {
    if (pageReady) web.current?.injectJavaScript(`window.polygroveShowMarks && window.polygroveShowMarks(${showObs}); true;`);
  }, [pageReady, showObs]);
  // a mark that carries its name needs no fetch: the page passes name/sci/date
  // along from the saved marks (user, 2026-10-06: nothing loads under the pin)
  const spotOf = (u: Under): (Spot & { grade: string }) | null => u.name
    ? { id: u.id, uri: `https://www.inaturalist.org/observations/${u.id}`, date: u.date ?? null, name: u.name, sci: u.sci ?? null, lng: u.lng ?? null, lat: u.lat ?? null, place: null, photo: null, credit: '', agree: 0, iconic: null, grade: '' }
    : null;
  const sightings = useSightings();   // declared here: the strip's picture below reads it
  // THE STRIP'S PICTURE IS YOUR OWN PHOTO OF THAT SIGHTING (user, 2026-10-07, of a
  // Mule Deer strip wearing the deck's stock photo: "this is not the photo I took
  // of a deer — aren't these supposed to be from the account"). First the photo
  // kept on the phone with THIS observation (earned / waiting / potential, matched
  // by its id); failing that the observation is looked up once for its photo (the
  // effect below). The deck card's photo only stands in while that lookup is out,
  // or when the sighting has no photo at all. (An earlier reading of "an image of
  // the card not iNaturalist" had put the card's photo first; that was about where
  // a TAP goes.)
  const ownPhoto = (u: Under): string | undefined => smallPhoto(
    sightings.earned.find(x => x.obsId === u.id)?.photo
    ?? sightings.waiting.find(x => x.obsId === u.id)?.photo
    ?? sightings.potential.find(x => x.obs.obsId === u.id)?.obs.photo);
  const cardPhoto = (u: Under): string | undefined => {
    const sci = u.sci?.toLowerCase();
    const card = sci ? getCards().find(c => c.sci.toLowerCase() === sci) : undefined;
    return card ? photoFor(card.id, 250) : undefined;
  };
  const fetching = useRef(new Set<number>());
  useEffect(() => {
    // the shown one and its neighbours are fetched ahead, so stepping is instant; the rest as you reach them
    // NOT WHILE THE TIMELINE PLAYS: the map passes over a sighting a second, and looking each
    // one up sent iNaturalist hundreds of requests in a play — it began refusing them (seen
    // 2026-11-17). The strip wears the card's photo meanwhile; the lookup runs once it rests.
    if (playWanted) return;
    const at = Math.min(underAt, Math.max(0, under.length - 1));
    for (const u of under.slice(Math.max(0, at - 1), at + 4)) {
      if (u.id in obsCache || fetching.current.has(u.id)) continue;
      if (u.name && ownPhoto(u)) continue;   // your photo of it is already on the phone: no lookup
      fetching.current.add(u.id);
      observation(u.id).then(o => setObsCache(c => ({ ...c, [u.id]: o }))).catch(() => setObsCache(c => ({ ...c, [u.id]: null })))
        .finally(() => fetching.current.delete(u.id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ownPhoto reads the sightings store, listed below
  }, [under, underAt, obsCache, sightings, playWanted]);
  // a tap on a ✕ puts those marks at the head of the list
  const onMark = (ids: number[], ok: number, marks?: Under[]) => {
    if (!ids.length) return;
    const head: Under[] = marks && marks.length ? marks : ids.map(id => ({ id, kind: ok }));
    setUnder(prev => [...head, ...prev.filter(u => !ids.includes(u.id))]); setUnderAt(0);
    // and OPEN it (user, 2026-10-06: "swipe right to this screen when you press
    // an x on the map"): the tapped sighting's screen slides in from the right
    const o = spotOf(head[0]);
    if (o) openObs(o);
  };
  const openObs = async (o: Spot & { grade: string }) => {
    const sci = o.sci?.toLowerCase();
    const card = sci ? getCards().find(c => c.sci.toLowerCase() === sci) : undefined;
    if (card) {
      let eid: number | null = null;
      if (o.lng != null && o.lat != null) { try { eid = await ecoregionAt(o.lng, o.lat); } catch { /* no outline: fall through */ } }
      if (eid != null && sightings.earned.some(e => e.eid === eid && e.speciesId === card.species_id)) { router.push({ pathname: '/preview', params: { kind: 'earned', key: `${eid}:${card.species_id}`, slide: 'right' } }); return; }
      // A ✕ ALWAYS OPENS THE OBSERVATION CARD (user, 2026-10-07: "when you click on an x it
      // should go to the observation card, you can then click on go to journal or go to
      // polygroveDB") — a card you hold there used to jump straight into the journal
      if (eid != null && owns(eid, card.species_id)) { router.push({ pathname: '/preview', params: { kind: 'card', key: `${eid}:${card.species_id}`, name: o.name, date: o.date ?? '', uri: o.uri, slide: 'right' } }); return; }
      // a card, but not yours there (not confirmed, or not in that deck): the preview knows which
      if (eid != null && sightings.potential.some(p => p.key === `${card.species_id}@${eid}`)) { router.push({ pathname: '/preview', params: { kind: 'potential', key: `${card.species_id}@${eid}`, slide: 'right' } }); return; }
    } else if (sci && sightings.potential.some(p => p.key === sci)) { router.push({ pathname: '/preview', params: { kind: 'potential', key: sci, slide: 'right' } }); return; }
    if (sightings.waiting.some(w => w.obsId === o.id)) { router.push({ pathname: '/preview', params: { kind: 'waiting', key: String(o.id), slide: 'right' } }); return; }
    // in none of the lists (they are capped): still its would-be card, not a web page (user, 2026-10-07)
    if (o.name) { router.push({ pathname: '/preview', params: { kind: 'obs', key: String(o.id), name: o.name, sci: o.sci ?? '', date: o.date ?? '', uri: o.uri, slide: 'right' } }); return; }
    openWeb(o.uri);   // not even a name: the observation itself
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
  const run = useSightingsRun();
  // ONLY THE YELLOW ✕s (user, 2026-11-17: "only highlight the observations that have been
  // confirmed by iNaturalist … and are a card … and remove the grey and green x's otherwise
  // from the screen"): a mark's third number is 1 for a sighting the community has confirmed
  // and that is a card in your journal, 0 for one still waiting (it was drawn green), 2 for
  // one confirmed with no card (grey). Only the 1s reach the map, its timeline and its play.
  const allMarks = sightings.marks;
  const marks = useMemo(() => allMarks.filter(m => (m[2] ?? 1) === 1), [allMarks]);
  const meId = sightings.me?.id, checkedAt = sightings.checkedAt;
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

  const onMessage = (e: FrameMessage) => {
    let m: { type: string; eid?: number | null; name?: string; bbox?: Pick['bbox']; dx?: number; dy?: number; ids?: unknown[]; ok?: number; marks?: unknown[]; lng?: number; lat?: number; on?: boolean };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') setPageReady(true);
    // the map is flying to a sighting (or has landed): the timeline holds still meanwhile
    if (m.type === 'fly') setFlying(!!m.on);
    if (m.type === 'center') {
      setPick(m.eid != null && m.name && m.bbox ? { eid: m.eid, name: m.name, bbox: m.bbox } : null);
      // the pin's spot, for the PolygroveDB tab's "near the pin" ranking (2026-10-06)
      if (typeof m.lng === 'number' && typeof m.lat === 'number') setPin({ lng: m.lng, lat: m.lat, eid: m.eid ?? null, name: m.name });
    }
    if (m.type === 'pan' && typeof m.dx === 'number' && typeof m.dy === 'number') onPan(m.dx, m.dy);
    if (m.type === 'mark' && Array.isArray(m.ids)) onMark(m.ids.map(Number).filter(Boolean), Number(m.ok ?? 1), Array.isArray(m.marks) ? (m.marks as Under[]).filter(u => u && Number.isFinite(u.id)) : undefined);
    if (m.type === 'under' && Array.isArray(m.marks)) { setUnder((m.marks as Under[]).filter(u => u && Number.isFinite(u.id))); setUnderAt(0); }
  };

  // NO GYRO TILT (user, 2026-10-06: "if the gyro kills performance remove
  // it"): the map leaned a few degrees with the phone from 2026-09-29; each
  // tilt re-rendered the whole 3D scene and an iPhone 13 Pro lagged even
  // with the marks hidden. The map is flat and still now; the pin still
  // leans against a drag (that comes from the page's pan messages).

  
const zoom = (d: number) => web.current?.injectJavaScript(`window.polygroveZoom && window.polygroveZoom(${d}); true;`);
  // earth colours or grey/black (user, 2026-10-07) — a remembered preference, sent to the page whenever it changes or the page comes up
  const earth = useEarthColours();
  useEffect(() => {
    if (pageReady) web.current?.injectJavaScript(`window.polygroveRelief && window.polygroveRelief(${earth}); true;`);
  }, [pageReady, earth]);
  // every ecoregion's outline on or off (user, 2026-10-07)
  const borders = useBorders();
  const [menuOpen, setMenuOpen] = useState(false);
  // the timeline's cut (user, 2026-10-07): only sightings up to this date are on the map; null = all.
  // With the ✕s switched off the timeline is gone, and so is its cut.
  const [until, setUntil] = useState<string | null>(null);
  // a play step also names the sighting it has reached, so the sightings of one day appear one at a time
  const [untilId, setUntilId] = useState<number | null>(null);
  // THE BAR TAKES THE ROW (user, 2026-11-17): while the ✕s are on and there is a timeline,
  // − and + step up out of the row to sit just above the bar's right end, the bar runs to
  // the right edge, and a play button sits between the fold-out tile and the bar. Switching
  // the ✕s off brings − and + back down.
  const timelineOn = showObs && hasTimeline(marks);
  // THE TIMELINE WAITS FOR THE MAP (user, 2026-11-17: "freeze the timeline while it's doing
  // the animation"): the page says when a flight to a sighting begins and ends; while one
  // is under way the play does not advance. A flight that never reports back (the page
  // reloaded mid-air) lets go after six seconds.
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    if (!flying) return;
    const t = setTimeout(() => setFlying(false), 6000);
    return () => clearTimeout(t);
  }, [flying]);
  const playing = playWanted && timelineOn;   // switching the ✕s off stops it (the ✕ tile also clears the wish)
  const zoomAway = useSharedValue(0);
  useEffect(() => { zoomAway.value = withTiming(timelineOn ? 1 : 0, { duration: 260 }); }, [timelineOn, zoomAway]);
  // − and + (and, on the left, the fold-out and ✕ tiles) RISE ABOVE THE BAR (user, 2026-11-17: "put the plus and minus above the bar instead of off the screen"; for an hour they slid off the right edge)
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -(42 + 8) * zoomAway.value }] }));
  // the timeline unrolls from its left edge, where the fold-out tile is: scaled
  // from nothing, and slid left by half of what is missing so that edge stays put
  const timelineIn = (v: { targetWidth: number }) => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ translateX: -v.targetWidth / 2 - 26 }, { scaleX: 0.02 }] },
      animations: { opacity: withTiming(1, { duration: 140 }), transform: [{ translateX: withTiming(0, { duration: 260 }) }, { scaleX: withTiming(1, { duration: 260 }) }] },
    };
  };
  const timelineOut = (v: { currentWidth: number }) => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }, { scaleX: 1 }] },
      animations: { opacity: withTiming(0, { duration: 200 }), transform: [{ translateX: withTiming(-v.currentWidth / 2 - 26, { duration: 200 }) }, { scaleX: withTiming(0.02, { duration: 200 }) }] },
    };
  };
  // every date goes with follow = true: the map glides to the latest sighting made by then,
  // zoomed in, whether the timeline is playing or dragged by hand, and returns to where it
  // began when the timeline is back at its end (user, 2026-11-17: "have the map follow the
  // x's … wherever it is on the timeline zoom to it")
  useEffect(() => {
    // the third number is how long a flight may take (the play's, or the page's own when dragged
    // by hand); the fourth is the sighting a play step has reached
    const on = showObs && until;
    if (pageReady) web.current?.injectJavaScript(`window.polygroveMarksUntil && window.polygroveMarksUntil(${on ? JSON.stringify(until) : 'null'}, true, ${playing ? PLAY_FLY_MS : 0}, ${on && untilId != null ? untilId : 'null'}); true;`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `playing` is read at send time; a change in it alone must not resend the date
  }, [pageReady, until, untilId, showObs]);
  // the title fades out while a sighting's strip is up and back in when it goes (user, 2026-10-07)
  const stripOn = showObs && under.length > 0;
  // the fade keeps step with the strip's own animation: 160 ms in, 240 ms out.
  // DERIVED from stripOn on every render, not set from an effect (2026-10-07: the
  // title went missing on an iPhone 13 — an effect that only fires when stripOn
  // CHANGES left the value stuck at "hidden" after a code refresh mid-strip)
  const titleUp = useDerivedValue(() => withTiming(stripOn ? 1 : 0, { duration: stripOn ? 160 : 240 }), [stripOn]);
  // THE STRIP APPEARS OUT OF NOWHERE AND LEAVES INTO THE DYNAMIC ISLAND (user,
  // 2026-10-07): it fades in where it sits; when the pin leaves the ✕ it folds
  // up into the island on an iPhone that has one (top inset 59 pt; a notch
  // gives 44–50, Android less) — its centre travels to the island's, ~29 pt
  // from the top — and slides off the top of the screen on any other phone.
  // The title only fades out and back, in place.
  const island = Platform.OS === 'ios' && insets.top >= 59;
  const fromIsland = 29 - (insets.top + 4 + 46);
  const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - titleUp.value }));
  const stripOut = () => {
    'worklet';
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
      animations: { opacity: withTiming(0, { duration: 240 }), transform: [{ translateY: withTiming(fromIsland, { duration: 240 }) }, { scale: withTiming(0.1, { duration: 240 }) }] },
    };
  };
  useEffect(() => {
    if (pageReady) web.current?.injectJavaScript(`window.polygroveBorders && window.polygroveBorders(${borders}); true;`);
  }, [pageReady, borders]);

  const enter = async () => {
    if (!pick) return;
    const m = ecoMeta(pick.eid);
    flownTo.current = pick.eid;   // the pin is already on it — no fly-back on return
    // the pin's spot becomes the camp's: packs and the PolygroveDB "Camp" list favour what is recorded closest to it
    const at = getPin();
    const spot = at && at.eid === pick.eid ? { lng: at.lng, lat: at.lat } : undefined;
    await setCurrentEco({ eid: pick.eid, name: pick.name, bbox: pick.bbox, size: ecoDeckSize(pick.eid), lead: m?.lead, photo: m?.photo, wiki: m?.wiki, spot });
    router.replace({ pathname: '/', params: { tab: '1' } });
  };

  const have = useCollection(pick?.eid).length;   // journaled there — "x / N species in deck" (user, 2026-10-05)
  // (in a browser this returned null until 2026-10-08 — no web view there; WebFrame.web.tsx is an iframe now)
  const size = pick && catalogReady ? ecoDeckSize(pick.eid) : null;
  const meta = pick && metaReady ? ecoMeta(pick.eid) : undefined;
  const here = !!pick && current?.eid === pick.eid;

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
        // gone while the timeline holds the map on a sighting — playing, or parked on a date (user, 2026-11-17: "remove the pin while going through them")
        <View style={[s.pin, { top: pinY - PIN_H }, (playing || (showObs && until != null)) && { opacity: 0 }]} pointerEvents="none">
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

      <Animated.View style={[s.top, { paddingTop: insets.top + 8 }, titleStyle]} pointerEvents="box-none">
        <View style={s.titleWrap}>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Where do you want to camp?</Text>
          <Text style={s.sub}>{pageReady ? 'move the map under the pin 🏕️' : err ? 'map unavailable' : 'loading ecoregions…'}</Text>
        </View>
      </Animated.View>

      {/* MAP CONTROLS (user, 2026-10-07): + in the bottom-right corner, − to its
          left, always there. In the bottom-LEFT corner, map preferences: open,
          four tiles rise above it — the pin's pull on packs, ecoregion borders,
          earth colours ⇄ grey/black, sightings ✕ on/off at the bottom. (Zoom came 2026-09-28; the compass came
          and went 2026-09-29.) */}
      {pageReady && (
        <Animated.View style={[s.zoom, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }, zoomStyle]} pointerEvents="box-none">
          <GlassTile on={false} onPress={() => zoom(-1)} label="Zoom out"><Text style={s.zoomTxt}>−</Text></GlassTile>
          <GlassTile on={false} onPress={() => zoom(1)} label="Zoom in"><Text style={s.zoomTxt}>+</Text></GlassTile>
        </Animated.View>
      )}
      {/* the sightings' timeline, between the preferences tile and − (user, 2026-10-07) */}
      {/* ALWAYS OUT WHILE THE ✕s ARE ON (user, 2026-10-07 — it was tied to the open
          menu for a few minutes): it unrolls rightward out of the bottom-left tile
          when the ✕s are switched on and folds back into it when they go off */}
      {pageReady && showObs && (
        <Animated.View entering={timelineIn} exiting={timelineOut} style={[s.timeline, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }]} pointerEvents="box-none">
          <ObsTimeline marks={marks} onUntil={(d, id) => { setUntil(d); setUntilId(id ?? null); }} playing={playing} hold={flying} onPlayEnd={() => setPlaying(false)} />
        </Animated.View>
      )}
      {/* THE ✕ TILE, ALWAYS OUT, right of the fold-out tile (user, 2026-11-17: "have the x button be
          to the right of the fold out button instead of inside the fold"): one tap shows or hides
          your sightings and their timeline, with no menu to open first */}
      {pageReady && (
        <Animated.View style={[s.obsTile, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }, zoomStyle]} pointerEvents="box-none">
          <GlassTile on={showObs} onPress={() => { setPlaying(false); setShowObs(!showObs); }} label={showObs ? 'Hide observations' : 'Show observations'}>
            <Text style={[s.obsX, !showObs && { color: 'rgba(255,255,255,0.5)' }]}>✕</Text>
          </GlassTile>
        </Animated.View>
      )}
      {/* play / pause, between the ✕ tile and the bar: the ✕s appear in the order you made them */}
      {pageReady && timelineOn && (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOutDown.duration(140)} style={[s.play, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }]} pointerEvents="box-none">
          <GlassTile on={false} onPress={() => setPlaying(p => !p)} label={playing ? 'Pause the timeline' : 'Play your sightings in the order you made them'}>
            <Svg width={18} height={18} viewBox="0 0 18 18">
              {playing
                ? <Path d="M4.2 2.8 h3 v12.4 h-3 Z M10.8 2.8 h3 v12.4 h-3 Z" fill={C.yellow} />
                : <Path d="M5 2.4 L15 9 L5 15.6 Z" fill={C.yellow} stroke={C.yellow} strokeWidth={1.2} strokeLinejoin="round" />}
            </Svg>
          </GlassTile>
        </Animated.View>
      )}
      {pageReady && (
        <Animated.View style={[s.prefs, { bottom: NAV_HEIGHT + insets.bottom + SHEET_H + 14 }, zoomStyle]} pointerEvents="box-none">
          {menuOpen && (
            <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)} style={s.zoomCol}>
              {/* DOES THE PIN'S SPOT MATTER, top of the list (user, 2026-11-16: "put the pin button on
                  the map — toggle whether the location of the pin matters or if it's just the
                  ecoregion for probability"). Red = packs favour what is recorded closest to the
                  campsite; grey = the whole ecoregion's deck, evenly. (Here 2026-10-08 → 11-16 too.) */}
              <GlassTile on={pinDraw} onPress={() => setPinDraw(!pinDraw)} label={pinDraw ? 'Packs from the whole ecoregion' : 'Packs from around the campsite'}>
                {/* the map's own push pin — ball, collar and needle; its red when on, grey when off */}
                {(() => { const on = pinDraw, line = on ? '#c45c54' : 'rgba(255,255,255,0.5)', fill = on ? 'rgba(196,92,84,0.35)' : 'rgba(255,255,255,0.1)'; return (
                <Svg width={16} height={25} viewBox="0 0 20 33">
                  <Path d="M8.8 13.4 L11.2 13.4 L10.25 29.7 L9.75 29.7 Z" fill={on ? '#c3c9ce' : 'rgba(255,255,255,0.5)'} />
                  <Ellipse cx="10" cy="13.2" rx="2.3" ry="0.9" fill={on ? '#8a9096' : 'rgba(255,255,255,0.1)'} stroke={on ? '#4a5056' : 'rgba(255,255,255,0.5)'} strokeWidth={0.9} />
                  <Circle cx="10" cy="7" r="6.5" fill={fill} stroke={line} strokeWidth={1.4} />
                  <Ellipse cx="7.2" cy="4.1" rx="2.2" ry="1.35" fill={on ? 'rgba(234,176,170,0.7)' : 'rgba(255,255,255,0.35)'} transform="rotate(-28 7.2 4.1)" />
                </Svg>); })()}
              </GlassTile>
              <GlassTile on={borders} onPress={() => setBorders(!borders)} label={borders ? 'Hide ecoregion borders' : 'Show ecoregion borders'}>
                <Svg width={24} height={24} viewBox="0 0 24 24">
                  <Path d={ECOBLOB} fill={borders ? 'rgba(129,199,132,0.22)' : 'rgba(255,255,255,0.1)'} stroke={borders ? C.greenSoft : 'rgba(255,255,255,0.85)'}
                    strokeWidth={1.3} strokeDasharray="2.2 1.8" strokeLinejoin="round" strokeLinecap="round" />
                </Svg>
              </GlassTile>
              <GlassTile on={earth} onPress={() => setEarthColours(!earth)} label={earth ? 'Grey map' : 'Earth colours'}>
                <Svg width={22} height={28} viewBox="0 0 24 32">
                  <Path d={AMERICAS} fill={earth ? 'rgba(129,199,132,0.28)' : 'rgba(255,255,255,0.16)'} stroke={earth ? C.greenSoft : 'rgba(255,255,255,0.85)'} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
                </Svg>
              </GlassTile>
              {/* (the ✕ tile was the lowest one in here until 2026-11-17; it now stands outside the fold, right of the fold-out tile) */}
            </Animated.View>
          )}
          {/* stays white and unlit when open (user, 2026-10-07: "have this not change to green when it's selected") */}
          <GlassTile on={false} onPress={() => setMenuOpen(v => !v)} label={menuOpen ? 'Close map preferences' : 'Map preferences'}>
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path d="M12 4 L20 8.5 L12 13 L4 8.5 Z" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.85)" strokeWidth={1.3} strokeLinejoin="round" />
              <Path d="M4.5 12.5 L12 16.7 L19.5 12.5 M4.5 16 L12 20.2 L19.5 16" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
            </Svg>
          </GlassTile>
        </Animated.View>
      )}


      {/* the ✕ mark under the pin: one at a time, ‹ › for the others. AT THE TOP, over the
          "Where do you want to camp?" title, which steps aside while it shows (user, 2026-10-07) */}
      {stripOn && (() => {
        const at = Math.min(underAt, under.length - 1), u = under[at];
        const o = spotOf(u) ?? obsCache[u.id];   // text from the mark itself; the cache only lends a photo
        const sci = o?.sci?.toLowerCase();
        const card = sci ? getCards().find(c => c.sci.toLowerCase() === sci) : undefined;
        const color = u.kind === 0 ? '#5fe35a' : u.kind === 2 ? '#aaaaaa' : C.yellow;
        return (
          <Animated.View entering={FadeIn.duration(160)} exiting={island ? stripOut : FadeOutUp.duration(240)} style={[s.underWrap, { top: insets.top + 4 }]} pointerEvents="box-none">
            <View style={s.under}>
              <Pressable onPress={() => setUnderAt(a => Math.max(0, a - 1))} disabled={at === 0} hitSlop={8} style={s.underArrow}>
                <Text style={[s.underArrowTxt, at === 0 && { opacity: 0.25 }]}>‹</Text>
              </Pressable>
              {/* a preview picture and more info, the height of both control rows
                  (user, 2026-10-07). The picture is ALWAYS THE CARD'S, never the
                  iNaturalist photo (user, 2026-10-07: "an image of the card not
                  inaturalist") — cached on the phone, so panning downloads nothing.
                  A species with no deck card shows its Sightings card's picture; failing that, its ✕. */}
              <Pressable onPress={() => o && openObs(o)} disabled={!o} style={s.underRow}>
                {(() => {
                  const uri = ownPhoto(u) ?? smallPhoto(obsCache[u.id]?.photo) ?? cardPhoto(u);
                  return uri ? <Image source={{ uri }} style={s.underPhoto} contentFit="cover" transition={150} />
                    : <View style={[s.underPhoto, { alignItems: 'center', justifyContent: 'center' }]}><Text style={[s.underNoCard, { color }]}>✕</Text></View>; })()}
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={s.underName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{o === undefined ? 'Loading…' : o === null ? 'Unavailable' : card?.name ?? o.name}</Text>
                  {o?.sci ? <Text style={s.underSci} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{o.sci}</Text> : null}
                  <Text style={[s.underMeta, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {u.kind === 0 ? 'waiting' : u.kind === 2 ? 'potential' : 'confirmed'}{o?.date ? ` · ${niceDate(o.date)}` : ''}
                  </Text>
                  {o ? <Text style={s.underHint} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{under.length > 1 ? `${at + 1} of ${under.length} · ` : ''}{card ? `${card.group} · ` : ''}tap for more ›</Text> : null}
                </View>
              </Pressable>
              <Pressable onPress={() => setUnderAt(a => Math.min(under.length - 1, a + 1))} disabled={at >= under.length - 1} hitSlop={8} style={s.underArrow}>
                <Text style={[s.underArrowTxt, at >= under.length - 1 && { opacity: 0.25 }]}>›</Text>
              </Pressable>
            </View>
          </Animated.View>
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
              <Text style={[s.enterTxt, here && s.enterTxtHere]}>{/* always "Camp here" (user, 2026-11-16; was Stay in / Return to / Explore ecoregion) */}Camp here</Text>
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
  // web: pointerEvents none on the root does not reach children marked box-none (the nav,
  // zoom, title), so the invisible map kept catching taps on other screens (user,
  // 2026-11-16: the Map tab did nothing from Camp). visibility:hidden takes it all out.
  hidden: { opacity: 0, ...(Platform.OS === 'web' ? ({ visibility: 'hidden' } as object) : null) },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  // no back button (user, 2026-09-29): the tab bar's Camp is the way home
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, gap: 10 },
  titleWrap: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(10,15,10,0.85)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  title: { fontFamily: F.display, fontSize: 15, color: '#ffe14d' },   // yellow (user, 2026-09-30 — after the ecoregion brown, white, dimmer white)
  sub: { fontFamily: F.sans, fontSize: 10.5, color: '#ffffff' },   // white (user, 2026-09-30; was grey)
  pin: { position: 'absolute', left: 0, right: 0, alignItems: 'center', height: PIN_H + 3 },
  zoom: { position: 'absolute', right: 14, gap: 8, flexDirection: 'row', alignItems: 'center' },
  prefs: { position: 'absolute', left: 14, gap: 8, alignItems: 'center' },
  // from the play tile to the right edge (it stopped short of − and + until 2026-11-17, when they began to step aside)
  // the bottom row is the fold-out tile and the ✕ tile on the left, − and + on the right.
  // When the timeline is out, all four step up one row (zoomStyle) and the row below is
  // the play tile and the bar, edge to edge (user, 2026-11-17: "move those two buttons above
  // the bar as well like the plus and minus")
  timeline: { position: 'absolute', left: 14 + 42 + 10, right: 14 },
  obsTile: { position: 'absolute', left: 14 + 42 + 8 },
  play: { position: 'absolute', left: 14 },
  zoomCol: { gap: 8, alignItems: 'center' },
  obsX: { fontFamily: F.sansBold, fontSize: 19, color: C.yellow, lineHeight: 23 },   // 10% smaller, with the map's marks (user, 2026-11-17; it was 21)   // the marks' yellow (user, 2026-10-07: green for a minute, then "yellow again")
  // the list of ✕ marks under the pin, left of the zoom buttons; its bottom lines up with theirs
  underWrap: { position: 'absolute', left: 14, right: 14, alignItems: 'flex-start' },   // edge to edge, › at the right edge (user, 2026-10-07)
  // 92 = the two control rows (42 + 8 + 42) to its right (user, 2026-10-07)
  under: { alignSelf: 'stretch', height: 92, flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 4, backgroundColor: 'rgba(10,15,10,0.9)', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  underRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  underPhoto: { width: 82, height: 82, borderRadius: 12, backgroundColor: '#1c2a1c' },
  underNoCard: { fontFamily: F.sansBold, fontSize: 26, lineHeight: 30, opacity: 0.8 },
  underName: { fontFamily: F.sansBold, fontSize: 13, color: C.text },
  underSci: { fontFamily: F.sans, fontSize: 11, color: '#9a9', fontStyle: 'italic' },
  underMeta: { fontFamily: F.sans, fontSize: 11.5 },
  underHint: { fontFamily: F.sans, fontSize: 10.5, color: '#777' },
  underArrow: { width: 18, height: 84, alignItems: 'center', justifyContent: 'center' },
  underArrowTxt: { fontFamily: F.sansBold, fontSize: 22, color: C.greenSoft, lineHeight: 26 },

  // the + / − green (user, 2026-09-30: brown for a minute, then "green again")
  zoomTxt: { fontFamily: F.sansBold, fontSize: 22, color: 'rgba(255,255,255,0.85)', lineHeight: 26 },   // white like the layers tile (user, 2026-10-07; green since 2026-09-30)
  lookBtn: {
    width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    // solid DARK GREEN (user, 2026-11-16: "too translucent" — the frosted glass vanished over the map);
    // a little blacker since 2026-11-17, and now the app's default button colour (constants BTN_BG)
    backgroundColor: BTN_BG,
    borderWidth: 1, borderColor: BTN_BORDER,
  },
  lookBtnOn: { borderColor: 'rgba(255,255,255,0.22)', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  lookShine: { position: 'absolute', top: 0, left: 10, right: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.28)' },
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
  // "Camp here" ("Stay in ecoregion" until 2026-11-16) (and Back to camp) in the camp's YELLOW (user, 2026-09-30; was a quiet dark green)
  enterHere: { backgroundColor: '#4CAF50' },   // GREEN (user, 2026-10-05), the map's own green for where you are; orange and yellow before
  enterTxtHere: { color: '#1a1a1a' },
  enterTxt: { fontFamily: F.display, fontSize: 14, color: C.text },
});
