// A CHEAP HEXAGON THUMBNAIL (2026-10-06): the combs show hundreds of photos at
// once and HexPhoto's masks and feathering made them crawl. This is one image
// clipped to a hexagon with a coloured border — all a 66 px cell needs.
// Memoised, so a comb redraws only the cells whose props changed (the ring).
// SOLAR GOLD (user, 2026-10-06: "for the hex border of solar level cards make
// it the glowing gold that's used for the x's on the map"): `shimmer` swaps
// the flat border for the map's glisten — deep yellow → yellow → pale yellow,
// each cell on its own phase — driven on the UI thread by one shared clock.

import { memo, useEffect } from 'react';
import Animated, { interpolateColor, makeMutable, useAnimatedProps, withRepeat, withTiming } from 'react-native-reanimated';
import { ClipPath, Defs, Image as SvgImage, Polygon, Svg } from 'react-native-svg';

const pts = (w: number, h: number, ox = 0, oy = 0) =>
  [[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]].map(([x, y]) => `${ox + x * w},${oy + y * h}`).join(' ');

// one clock for every shimmering hexagon: 0 → 1 over 1.8 s, forever — started
// on the first shimmering cell's mount, not at module load (Metro's web/node
// render of the routes has no requestAnimationFrame, 2026-10-07)
const clock = makeMutable(0);
let clockStarted = false;
const startClock = () => { if (!clockStarted) { clockStarted = true; clock.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false); } };
const GOLD = ['rgb(255,200,60)', 'rgb(255,225,77)', 'rgb(255,245,160)'];   // the map's marks (map.html shimmerMarks)
const APolygon = Animated.createAnimatedComponent(Polygon);

function ShimmerBorder({ points, phase }: { points: string; phase: number }) {
  useEffect(() => { startClock(); }, []);
  const props = useAnimatedProps(() => {
    const a = (clock.value + phase) * Math.PI * 2;
    const m = 0.5 + 0.25 * Math.sin(a) + 0.25 * Math.sin(1.618 * a);   // the map's two-sine glisten
    return { fill: interpolateColor(m, [0, 0.5, 1], GOLD) };
  });
  return <APolygon points={points} animatedProps={props} />;
}

let _seq = 0;
function HexThumb({ uri, width, height, borderColor, borderWidth = 3, shimmer = false }:
  { uri?: string; width: number; height: number; borderColor: string; borderWidth?: number; shimmer?: boolean }) {
  const B = borderWidth, iw = width - B * 2, ih = height - B * 2;
  const id = `ht${_seq++}`;
  // a stable per-cell phase from the photo url, so neighbours do not pulse in step
  let h = 0; for (let i = 0; i < (uri?.length ?? 0); i++) h = (h * 31 + uri!.charCodeAt(i)) >>> 0;
  return (
    <Svg width={width} height={height}>
      <Defs><ClipPath id={id}><Polygon points={pts(iw, ih, B, B)} /></ClipPath></Defs>
      {shimmer ? <ShimmerBorder points={pts(width, height)} phase={(h % 101) / 101} /> : <Polygon points={pts(width, height)} fill={borderColor} />}
      <Polygon points={pts(iw, ih, B, B)} fill="#111111" />
      {uri ? <SvgImage href={{ uri }} x={B} y={B} width={iw} height={ih} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} /> : null}
    </Svg>
  );
}
export default memo(HexThumb);
