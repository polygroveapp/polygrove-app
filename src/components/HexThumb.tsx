// A CHEAP HEXAGON THUMBNAIL (2026-10-06): the combs show hundreds of photos at
// once and HexPhoto's masks and feathering made them crawl. This is one image
// clipped to a hexagon with a coloured border — all a 66 px cell needs.
// Memoised, so a comb redraws only the cells whose props changed (the ring).

import { memo } from 'react';
import { ClipPath, Defs, Image as SvgImage, Polygon, Svg } from 'react-native-svg';

const pts = (w: number, h: number, ox = 0, oy = 0) =>
  [[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]].map(([x, y]) => `${ox + x * w},${oy + y * h}`).join(' ');

let _seq = 0;
function HexThumb({ uri, width, height, borderColor, borderWidth = 3 }: { uri?: string; width: number; height: number; borderColor: string; borderWidth?: number }) {
  const B = borderWidth, iw = width - B * 2, ih = height - B * 2;
  const id = `ht${_seq++}`;
  return (
    <Svg width={width} height={height}>
      <Defs><ClipPath id={id}><Polygon points={pts(iw, ih, B, B)} /></ClipPath></Defs>
      <Polygon points={pts(width, height)} fill={borderColor} />
      <Polygon points={pts(iw, ih, B, B)} fill="#111111" />
      {uri ? <SvgImage href={{ uri }} x={B} y={B} width={iw} height={ih} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} /> : null}
    </Svg>
  );
}
export default memo(HexThumb);
