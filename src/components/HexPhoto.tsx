// The Polygrove hexagon photo — EXACT explorer geometry (index.html .dc-hex /
// .bighex): pointy-top hex, TALLER than wide (46x52, 148x167 → ratio 0.885),
// colored border, #111 well, photo clipped inside.
//
// FRAMING (2026-09-29): a centre crop cut the subject on four cards in five —
// a whooping crane lost its head and feet. The pipeline now finds each photo's
// subject and says how the photo should sit (framing.json, lib/catalog
// framingFor): `frame` = [aspect, scale, cx, cy] — the photo's width/height,
// its size relative to filling the hexagon, and where its centre goes, as a
// fraction of the hexagon's width and height. Slid photos still fill the
// hexagon. A photo that had to shrink (scale < 1) sits on a blurred, darkened
// copy of itself, its exposed edges feathered into it — never on a blank well.

import {
  ClipPath, Defs, FeGaussianBlur, Filter, G, Image as SvgImage, LinearGradient, Mask, Polygon, Rect, Stop, Svg,
} from 'react-native-svg';

export type Frame = [aspect: number, scale: number, cx: number, cy: number];

const pts = (w: number, h: number, ox = 0, oy = 0) =>
  [[0.5, 0], [1, 0.25], [1, 0.75], [0.5, 1], [0, 0.75], [0, 0.25]]
    .map(([x, y]) => `${ox + x * w},${oy + y * h}`).join(' ');

let _seq = 0;

export default function HexPhoto({
  uri, width, height, borderColor = 'rgba(255,255,255,0.18)', borderWidth = 3, frame,
}: { uri?: string; width: number; height: number; borderColor?: string; borderWidth?: number; frame?: Frame }) {
  const iw = width - borderWidth * 2, ih = height - borderWidth * 2;
  const id = `hx${_seq++}`;
  const B = borderWidth;

  let photo: React.ReactNode = null;
  if (uri && frame) {
    const [a, z, cx, cy] = frame;
    const cover = Math.max(iw / a, ih);             // the photo is a × 1 in its own units
    const dw = a * cover * z, dh = cover * z;
    const x = B + iw / 2 + cx * iw - dw / 2, y = B + ih / 2 + cy * ih - dh / 2;
    const shrunk = z < 0.999;
    // which of the photo's edges show inside the hexagon: those get feathered
    const f = Math.max(3, ih * 0.07), e = 0.5;
    const L = x > B + e, R = x + dw < B + iw - e, T = y > B + e, Bt = y + dh < B + ih - e;
    const bw = a * cover * 1.3, bh = cover * 1.3;   // the backdrop: the same photo, larger
    photo = (
      <G clipPath={`url(#${id})`}>
        {shrunk && <>
          <SvgImage href={{ uri }} x={B + iw / 2 - bw / 2} y={B + ih / 2 - bh / 2} width={bw} height={bh}
            preserveAspectRatio="xMidYMid slice"
            // the blur only where it can be seen: on a 58px tile a stretched
            // copy already reads as soft, and a list of filters is slow
            filter={width >= 120 ? `url(#${id}b)` : undefined} />
          <Rect x={B} y={B} width={iw} height={ih} fill="#000" opacity={0.38} />
        </>}
        <G mask={shrunk && (L || R) ? `url(#${id}h)` : undefined}>
          <G mask={shrunk && (T || Bt) ? `url(#${id}v)` : undefined}>
            <SvgImage href={{ uri }} x={x} y={y} width={dw} height={dh} preserveAspectRatio="xMidYMid slice" />
          </G>
        </G>
        {shrunk && (
          <Defs>
            <Filter id={`${id}b`} x="-10%" y="-10%" width="120%" height="120%">
              <FeGaussianBlur stdDeviation={Math.max(4, iw * 0.05)} />
            </Filter>
            <LinearGradient id={`${id}hg`} gradientUnits="userSpaceOnUse" x1={x} y1={0} x2={x + dw} y2={0}>
              <Stop offset={0} stopColor="#fff" stopOpacity={L ? 0 : 1} />
              <Stop offset={f / dw} stopColor="#fff" stopOpacity={1} />
              <Stop offset={1 - f / dw} stopColor="#fff" stopOpacity={1} />
              <Stop offset={1} stopColor="#fff" stopOpacity={R ? 0 : 1} />
            </LinearGradient>
            <LinearGradient id={`${id}vg`} gradientUnits="userSpaceOnUse" x1={0} y1={y} x2={0} y2={y + dh}>
              <Stop offset={0} stopColor="#fff" stopOpacity={T ? 0 : 1} />
              <Stop offset={f / dh} stopColor="#fff" stopOpacity={1} />
              <Stop offset={1 - f / dh} stopColor="#fff" stopOpacity={1} />
              <Stop offset={1} stopColor="#fff" stopOpacity={Bt ? 0 : 1} />
            </LinearGradient>
            <Mask id={`${id}h`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
              <Rect x={x} y={y} width={dw} height={dh} fill={`url(#${id}hg)`} />
            </Mask>
            <Mask id={`${id}v`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
              <Rect x={x} y={y} width={dw} height={dh} fill={`url(#${id}vg)`} />
            </Mask>
          </Defs>
        )}
      </G>
    );
  } else if (uri) {
    photo = (
      <SvgImage
        href={{ uri }} x={B} y={B}
        width={iw} height={ih}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${id})`}
      />
    );
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <ClipPath id={id}><Polygon points={pts(iw, ih, B, B)} /></ClipPath>
      </Defs>
      <Polygon points={pts(width, height)} fill={borderColor} />
      <Polygon points={pts(iw, ih, B, B)} fill="#111111" />
      {photo}
    </Svg>
  );
}
