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

// PLAYING (user, 2026-11-17: "a play pause button … it should follow the journey of the x's
// as you made them"): while `playing`, the thumb walks forward through the months on its own
// and the map shows each sighting as its month arrives — from an empty map, if the thumb was
// resting at the end. It stops at the latest month (onPlayEnd), or when you take hold of the bar.
export default function ObsTimeline({ marks, onUntil, playing = false, onPlayEnd }: {
  marks: Mark[]; onUntil: (date: string | null) => void; playing?: boolean; onPlayEnd?: () => void;
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

  // the walk: about eight seconds end to end however long the span, never faster than a
  // month every 80 ms nor slower than one every 400 ms
  const atRef = useRef<number | null>(null);
  const endRef = useRef(onPlayEnd);
  useEffect(() => { endRef.current = onPlayEnd; }, [onPlayEnd]);
  useEffect(() => {
    if (!playing) return;
    const s = span.current; if (!s) { endRef.current?.(); return; }
    const months = s.max - s.min + 1;
    const every = Math.max(80, Math.min(400, Math.round(8000 / months)));
    const inc = Math.max(1, Math.ceil(months / 100));
    // from the end (or before the start) it begins again on an empty map
    if (atRef.current == null || atRef.current >= s.max) show(s.min - 1);
    const id = setInterval(() => {
      const sp = span.current; if (!sp) return;
      const next = (atRef.current ?? sp.min - 1) + inc;
      if (next >= sp.max) { show(null); clearInterval(id); endRef.current?.(); } else show(next);
    }, every);
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
