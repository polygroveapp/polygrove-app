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
import { C, F } from '../constants/polygrove';
import type { Mark } from '../lib/sightings';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BARS = 36;
const PAD = 10;   // the track's inner margin, so the thumb can reach both ends

export default function ObsTimeline({ marks, onUntil }: { marks: Mark[]; onUntil: (date: string | null) => void }) {
  // month numbers (year × 12 + month) of every dated sighting, and the span they cover
  const t = useMemo(() => {
    const ms: number[] = [];
    for (const m of marks) { const d = m[6]; if (d && d.length >= 7) { const y = +d.slice(0, 4), mo = +d.slice(5, 7); if (y > 1900 && mo >= 1 && mo <= 12) ms.push(y * 12 + mo - 1); } }
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

  const move = (pageX: number) => {
    const s = span.current; if (!s) return;
    const f = Math.max(0, Math.min(1, (pageX - geo.current.x - PAD) / Math.max(1, geo.current.w - 2 * PAD)));
    // the far left is the month BEFORE the first sighting: an empty map (user, 2026-10-07:
    // "the x's should disappear if the timeline is to the left")
    const m = s.min - 1 + Math.round(f * (s.max - s.min + 1)), v = m >= s.max ? null : m;
    setAt(v);
    if (v === sent.current) return;   // the map is told once per month crossed, not once per pixel
    sent.current = v;
    // the last day any month can have: the page compares dates as text
    onUntil(v == null ? null : `${Math.floor(v / 12)}-${String((v % 12) + 1).padStart(2, '0')}-31`);
  };

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
        onResponderGrant={e => { measure(); setDrag(true); move(e.nativeEvent.pageX); }}
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
    backgroundColor: Platform.OS === 'android' ? 'rgba(16,22,16,0.9)' : 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
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
