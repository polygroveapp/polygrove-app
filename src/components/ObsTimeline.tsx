// THE TIMELINE OF YOUR SIGHTINGS (user, 2026-10-07: "when the x button is
// activated have a scroll bar at the bottom of the screen between the fold out
// button and − that is the timeline of all the observations"). A glass pill
// holding a little histogram — one bar per stretch of months, as tall as the
// sightings made in it — and a thumb you drag back through time: the map then
// shows only what you had seen up to that month. At the right end (where it
// rests) everything shows. Nothing here leaves the phone: the dates are the
// ones already saved with the ✕ marks.

import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BTN_BG, BTN_BORDER, C, F } from '../constants/polygrove';
import type { Mark } from '../lib/sightings';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BARS = 36;
const PAD = 10;   // the track's inner margin, so the thumb can reach both ends

// month numbers (year × 12 + month) of every dated sighting
function monthsOf(marks: Mark[]): number[] {
  const ms: number[] = [];
  for (const m of marks) { const d = m[6]; if (d && d.length >= 7) { const y = +d.slice(0, 4), mo = +d.slice(5, 7); if (y > 1900 && mo >= 1 && mo <= 12) ms.push(y * 12 + mo - 1); } }
  return ms;
}
// is there a timeline to show? Sightings in at least two different months (the map's
// other controls make room for the bar only when there is one)
export function hasTimeline(marks: Mark[]): boolean {
  const ms = monthsOf(marks);
  return ms.length > 1 && ms.some(v => v !== ms[0]);
}

// how long a flight between two far-apart sightings may take during a play, in ms (the map
// glides between near ones much faster); sent to the map with every step
export const PLAY_FLY_MS = 1800;
// the pause on each sighting once the map is there, before the next one
const PLAY_DWELL_MS = 260;

// the sightings a play visits, in the order they were made: by date, then by iNaturalist id
// (ids are handed out as observations are uploaded, so within a day this is the order you
// added them).
// ONLY THE ONES THAT ARE CARDS (user, 2026-11-17: "only highlight the observations that have
// been confirmed by iNaturalist … and are a card"): a mark's third number is 1 for a sighting
// the community has confirmed AND that is a card in your journal, 0 for one still waiting,
// 2 for one confirmed with no card. The others still appear on the map as their day comes;
// the map just does not stop on them.
type Step = { date: string; id: number; month: number };
function stepsOf(marks: Mark[]): Step[] {
  const out: Step[] = [];
  for (const m of marks) {
    const d = m[6];
    if (!d || d.length < 7 || (m[2] ?? 1) !== 1) continue;
    const y = +d.slice(0, 4), mo = +d.slice(5, 7);
    if (!(y > 1900 && mo >= 1 && mo <= 12)) continue;
    out.push({ date: d, id: Number(m[3]) || 0, month: y * 12 + mo - 1 });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
}

// PLAYING (user, 2026-11-17: "a play pause button … it should follow the journey of the x's
// as you made them"), ONE SIGHTING AT A TIME (same day: "it's going way too fast, you should
// be able to follow every single observation when pressing play"). While `playing`, the
// sightings appear one by one in the order they were made — from an empty map, if the thumb
// was resting at the end — and the map goes to each: a glide to one nearby, a flight to one
// far off, then a short rest on it. The thumb keeps pace by month. However many sightings
// there are, none is skipped; an account with 1,500 takes a quarter of an hour, and pausing
// or dragging the bar is how you jump. It stops after the last one (onPlayEnd), or when you
// take hold of the bar.
// hold: the map is still on its way to the sighting just revealed; the next one waits.
// onUntil(date, id): the cut the map draws to. A drag gives only a date (the end of a month);
// a play step also gives the sighting's id, so the sightings of one day still come singly.
export default function ObsTimeline({ marks, onUntil, playing = false, hold = false, onPlayEnd }: {
  marks: Mark[]; onUntil: (date: string | null, id?: number | null) => void; playing?: boolean; hold?: boolean; onPlayEnd?: () => void;
}) {
  // the span the dated sightings cover
  const t = useMemo(() => {
    const ms = monthsOf(marks);
    if (!ms.length) return null;
    let min = ms[0], max = ms[0];
    for (const v of ms) { if (v < min) min = v; if (v > max) max = v; }
    if (max === min) return null;   // one month of sightings is no timeline
    const n = Math.min(BARS, max - min + 1), bars = new Array<number>(n).fill(0), perMonth = new Array<number>(max - min + 1).fill(0);
    for (const v of ms) { perMonth[v - min]++; bars[Math.min(n - 1, Math.floor(((v - min) / (max - min + 1)) * n))]++; }
    const upTo: number[] = []; let run = 0;
    for (const c of perMonth) { run += c; upTo.push(run); }
    return { min, max, bars, top: Math.max(...bars), upTo, total: ms.length };
  }, [marks]);

  const [at, setAt] = useState<number | null>(null);   // the chosen month; null = the latest (everything)
  const [drag, setDrag] = useState(false);
  const box = useRef<View>(null), geo = useRef({ x: 0, w: 1 }), sent = useRef<number | null>(null), span = useRef(t);
  useEffect(() => { span.current = t; }, [t]);
  const measure = () => box.current?.measureInWindow((x, _y, w) => { geo.current = { x, w: Math.max(1, w) }; });

  // show the map as it stood at month v (null = everything)
  const show = (v: number | null) => {
    setAt(v); atRef.current = v;
    if (v === sent.current) return;   // the map is told once per month crossed, not once per pixel
    sent.current = v;
    // the last day any month can have: the page compares dates as text
    onUntil(v == null ? null : `${Math.floor(v / 12)}-${String((v % 12) + 1).padStart(2, '0')}-31`);
  };
  const move = (pageX: number) => {
    const s = span.current; if (!s) return;
    const f = Math.max(0, Math.min(1, (pageX - geo.current.x - PAD) / Math.max(1, geo.current.w - 2 * PAD)));
    // the far left is the month BEFORE the first sighting: an empty map (user, 2026-10-07:
    // "the x's should disappear if the timeline is to the left")
    const m = s.min - 1 + Math.round(f * (s.max - s.min + 1));
    show(m >= s.max ? null : m);
  };

  // the walk
  const atRef = useRef<number | null>(null);
  const endRef = useRef(onPlayEnd);
  useEffect(() => { endRef.current = onPlayEnd; }, [onPlayEnd]);
  const holdRef = useRef(hold);
  useEffect(() => { holdRef.current = hold; }, [hold]);
  const steps = useMemo(() => stepsOf(marks), [marks]);
  const stepsRef = useRef(steps);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  const kRef = useRef(-1);          // the sighting the play is on; -1 = none yet
  useEffect(() => {
    if (!playing) return;
    const s = span.current, all = stepsRef.current;
    if (!s || !all.length) { endRef.current?.(); return; }
    // where to begin: from the end (or before the start) on an empty map; after a pause, where
    // it stopped; after a drag, at the last sighting of the month the thumb was left on
    const cur = atRef.current;
    if (cur == null || cur >= s.max) { kRef.current = -1; show(s.min - 1); }
    else if (!(kRef.current >= 0 && all[kRef.current]?.month === cur)) {
      let k = -1;
      for (let i = 0; i < all.length && all[i].month <= cur; i++) k = i;
      kRef.current = k;
    }
    let nextAt = Date.now() + 400, waiting = false;
    const id = setInterval(() => {
      const list = stepsRef.current;
      if (holdRef.current) { waiting = true; return; }                        // the map is on its way: wait for it
      if (waiting) { waiting = false; nextAt = Date.now() + PLAY_DWELL_MS; }   // it has arrived: rest a moment
      if (Date.now() < nextAt) return;
      const k = kRef.current + 1;
      if (k >= list.length) { kRef.current = -1; show(null); clearInterval(id); endRef.current?.(); return; }
      kRef.current = k;
      const st = list[k];
      setAt(st.month); atRef.current = st.month; sent.current = st.month;
      onUntil(st.date, st.id);
      nextAt = Date.now() + PLAY_DWELL_MS;   // if the map need not move, this is all the wait there is
    }, 60);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  if (!t) return null;
  const cur = at == null || at > t.max || at < t.min - 1 ? t.max : at;
  const frac = (cur - (t.min - 1)) / (t.max - t.min + 1);
  const label = `${MONTHS[cur % 12]} ${Math.floor(cur / 12)}`;
  const count = cur < t.min ? 0 : t.upTo[cur - t.min];
  const inner = (
    <>
      <View style={s.bars} pointerEvents="none">
        {t.bars.map((c, i) => {
          const on = frac > 0 && (i + 0.5) / t.bars.length <= frac + 0.5 / t.bars.length;
          return <View key={i} style={[s.bar, { height: c ? 3 + 21 * Math.sqrt(c / t.top) : 2, backgroundColor: on ? C.yellow : 'rgba(255,255,255,0.22)', opacity: on ? 0.9 : 1 }]} />;
        })}
      </View>
      <View pointerEvents="none" style={[s.thumbRail, { left: PAD, right: PAD }]}>
        <View style={[s.thumb, { left: `${frac * 100}%` }, drag && s.thumbDrag]} />
      </View>
    </>
  );
  return (
    <View style={s.wrap} pointerEvents="box-none">
      {/* what the thumb means, above it — only while your finger is on the bar (user, 2026-10-07:
          "this should disappear if you're not scrolling"); the thumb and the lit bars still show the cut */}
      {drag && (
        <View pointerEvents="none" style={s.tipRow}>
          <View style={s.tip}>
            <Text style={s.tipTxt}>{cur < t.min ? 'before your first sighting' : `up to ${label}`}</Text>
            <Text style={s.tipSub}>{count.toLocaleString()} of {t.total.toLocaleString()}</Text>
          </View>
        </View>
      )}
      <View ref={box} onLayout={measure}
        // the plain responder props (not PanResponder): the pill claims the touch, so the map under it stays put
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
        onResponderGrant={e => { if (playing) endRef.current?.(); measure(); setDrag(true); move(e.nativeEvent.pageX); }}
        onResponderMove={e => move(e.nativeEvent.pageX)}
        onResponderRelease={() => setDrag(false)} onResponderTerminate={() => setDrag(false)}
        accessibilityRole="adjustable" accessibilityLabel={`Sightings timeline, up to ${label}`}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={28} tint="dark" style={s.pill}>{inner}</BlurView>
          : <View style={s.pill}>{inner}</View>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  pill: {
    height: 42, borderRadius: 21, overflow: 'hidden', justifyContent: 'center',
    // the default button fill wherever there is no blur behind it (the web and Android); iOS keeps its frosted glass
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.06)' : BTN_BG,
    borderWidth: 1, borderColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.13)' : BTN_BORDER,
  },
  bars: { position: 'absolute', left: PAD, right: PAD, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 1.5 },
  bar: { flex: 1, borderRadius: 1.5, minWidth: 1 },
  thumbRail: { position: 'absolute', top: 0, bottom: 0 },
  thumb: { position: 'absolute', top: 5, bottom: 5, width: 4, marginLeft: -2, borderRadius: 2, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  thumbDrag: { top: 2, bottom: 2, width: 6, marginLeft: -3, backgroundColor: C.yellow },
  tipRow: { position: 'absolute', left: 0, right: 0, bottom: 48, alignItems: 'center' },
  tip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(10,15,10,0.92)', borderWidth: 1, borderColor: 'rgba(255,225,77,0.35)', alignItems: 'center' },
  tipTxt: { fontFamily: F.sansBold, fontSize: 12.5, color: C.yellow },
  tipSub: { fontFamily: F.sans, fontSize: 10.5, color: '#aaa' },
});
