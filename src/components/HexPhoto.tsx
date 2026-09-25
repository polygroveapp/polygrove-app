// The demo's hexagonal species photo: pointy-top hex, colored border, photo
// clipped inside. Geometry = HEX_CLIP polygon(50% 0, 100% 25, 100% 75, 50% 100,
// 0 75, 0 25) from App.jsx, drawn with react-native-svg.

import { Image as SvgImage, ClipPath, Defs, Polygon, Svg } from 'react-native-svg';

const hexPoints = (s: number, o = 0) =>
  [[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]]
    .map(([x, y]) => `${o + x * s},${o + y * s}`).join(' ');

let _seq = 0;

export default function HexPhoto({
  uri, size = 72, borderColor = 'rgba(255,255,255,0.18)', borderWidth = 3,
}: { uri?: string; size?: number; borderColor?: string; borderWidth?: number }) {
  const inner = size - borderWidth * 2;
  const id = `hx${_seq++}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <ClipPath id={id}><Polygon points={hexPoints(inner, borderWidth)} /></ClipPath>
      </Defs>
      <Polygon points={hexPoints(size)} fill={borderColor} />
      <Polygon points={hexPoints(inner, borderWidth)} fill="#1a1a1a" />
      {!!uri && (
        <SvgImage
          href={{ uri }} x={borderWidth} y={borderWidth}
          width={inner} height={inner}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
        />
      )}
    </Svg>
  );
}
