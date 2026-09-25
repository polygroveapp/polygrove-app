// The Polygrove hexagon photo — EXACT explorer geometry (index.html .dc-hex /
// .bighex): pointy-top hex, TALLER than wide (46x52, 148x167 → ratio 0.885),
// colored border, #111 well, photo clipped inside.

import { Image as SvgImage, ClipPath, Defs, Polygon, Svg } from 'react-native-svg';

const pts = (w: number, h: number, ox = 0, oy = 0) =>
  [[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]]
    .map(([x, y]) => `${ox + x * w},${oy + y * h}`).join(' ');

let _seq = 0;

export default function HexPhoto({
  uri, width, height, borderColor = 'rgba(255,255,255,0.18)', borderWidth = 3,
}: { uri?: string; width: number; height: number; borderColor?: string; borderWidth?: number }) {
  const iw = width - borderWidth * 2, ih = height - borderWidth * 2;
  const id = `hx${_seq++}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={id}><Polygon points={pts(iw, ih, borderWidth, borderWidth)} /></ClipPath>
      </Defs>
      <Polygon points={pts(width, height)} fill={borderColor} />
      <Polygon points={pts(iw, ih, borderWidth, borderWidth)} fill="#111111" />
      {!!uri && (
        <SvgImage
          href={{ uri }} x={borderWidth} y={borderWidth}
          width={iw} height={ih}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
        />
      )}
    </Svg>
  );
}
