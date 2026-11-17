// fwGraphSVG (explorer index.html:805), ported 1:1. One component, two
// instances like the site: 'sm' (card back, no labels) and 'lg' (expanded,
// labels + records + group). Predators fan the top semicircle, prey the
// bottom; arrows always flow DOWN and meet each hexagon at its exact boundary.

import { Platform } from 'react-native';
import { G, Image as SvgImage, ClipPath, Defs, Line, Polygon, Svg, TSpan, Text as SvgText } from 'react-native-svg';
import { F, TROPHIC_COLOR } from '../constants/polygrove';
import { Card, cardByName, photoFor } from '../lib/catalog';

// rnsvg's onPress on web leaks RN responder props into the DOM (console noise) —
// use the DOM's own onClick there
const pressProps = (fn?: () => void): any =>
  fn ? (Platform.OS === 'web' ? { onClick: fn } : { onPress: fn }) : {};

const hexPts = (x: number, y: number, s: number) =>
  `${x},${y - s} ${x + s},${y - s / 2} ${x + s},${y + s / 2} ${x},${y + s} ${x - s},${y + s / 2} ${x - s},${y - s / 2}`;

function rayHex(x: number, y: number, s2: number, ux: number, uy: number): [number, number] {
  const V = [[x, y - s2], [x + s2, y - s2 / 2], [x + s2, y + s2 / 2], [x, y + s2], [x - s2, y + s2 / 2], [x - s2, y - s2 / 2]];
  let best: [number, number] = [x + ux * s2, y + uy * s2], bt = 1e9;
  for (let e = 0; e < 6; e++) {
    const [x1, y1] = V[e], [x2, y2] = V[(e + 1) % 6], ex = x2 - x1, ey = y2 - y1;
    const den = ux * ey - uy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - x) * ey - (y1 - y) * ex) / den; if (t <= 0 || t >= bt) continue;
    const u = Math.abs(ex) > Math.abs(ey) ? ((x + t * ux) - x1) / ex : ((y + t * uy) - y1) / ey;
    if (u >= -0.001 && u <= 1.001) { bt = t; best = [x + t * ux, y + t * uy]; }
  }
  return best;
}

function fwWrap(name: string, maxLen = 16): string[] {
  if (name.length <= maxLen) return [name];
  const mid = name.length / 2; let best = -1, bd = 1e9;
  for (let i = 0; i < name.length; i++) if (name[i] === ' ') { const d = Math.abs(i - mid); if (d < bd) { bd = d; best = i; } }
  return best < 0 ? [name] : [name.slice(0, best), name.slice(best + 1)];
}

let _seq = 0;

export default function FwGraph({ card, viewW, viewH, nodeR, centerR, fontSize, radiusFactor, showLabels, onNodePress }: {
  card: Card; viewW: number; viewH: number; nodeR: number; centerR: number;
  fontSize: number; radiusFactor: number; showLabels: boolean;
  onNodePress?: (id: string) => void;
}) {
  const preds = (card.foodweb?.eatenBy || []).slice(0, 4);
  const prey = (card.foodweb?.eats || []).slice(0, 4);
  if (!preds.length && !prey.length) return null;
  const inst = `fw${_seq++}`;
  const tc = TROPHIC_COLOR[card.trophic] || '#81C784';
  const rowOff = Math.min(viewW, viewH) * radiusFactor;
  // a one-sided web (only eaten-by, or only eats) is re-centred on its own
  // half so the drawing sits in the middle, not in the top or bottom half
  // (user, 2026-10-06: the acorn woodpecker's web hung low)
  const shift = !preds.length ? -rowOff / 2 : !prey.length ? rowOff / 2 : 0;
  const cx = viewW / 2, cy = viewH / 2 - (showLabels ? 6 : 0) + shift;
  const mk = (list: typeof preds, pred: boolean) => list.map((sp, i) => {
    const a = ((pred ? -180 : 0) + (i + 0.5) * 180 / list.length) * Math.PI / 180;
    return { ...sp, x: cx + Math.cos(a) * rowOff, y: cy + Math.sin(a) * rowOff, pred };
  });
  const nodes = [...mk(preds, true), ...mk(prey, false)];
  const lineW = showLabels ? 1.5 : 1.2;
  const focalPhoto = photoFor(card.id, 250);

  return (
    <Svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height="100%">
      {nodes.map((sp, i) => {
        const dx = sp.x - cx, dy = sp.y - cy, dist = Math.hypot(dx, dy), ux = dx / dist, uy = dy / dist;
        const [fx, fy] = rayHex(cx, cy, centerR + 1, ux, uy);
        const [nx2, ny2] = rayHex(sp.x, sp.y, nodeR + 1, -ux, -uy);
        const [x1, y1, x2, y2] = sp.pred ? [nx2, ny2, fx, fy] : [fx, fy, nx2, ny2];
        const L = Math.hypot(x2 - x1, y2 - y1), lux = (x2 - x1) / L, luy = (y2 - y1) / L;
        const ah = showLabels ? 9 : 6.5;
        const bx = x2 - lux * ah, by = y2 - luy * ah, px = -luy, py = lux;
        return (
          <G key={`l${i}`}>
            <Line x1={x1} y1={y1} x2={bx} y2={by} stroke="#3a3a3a" strokeWidth={lineW} />
            <Polygon points={`${x2},${y2} ${bx + px * ah * 0.45},${by + py * ah * 0.45} ${bx - px * ah * 0.45},${by - py * ah * 0.45}`} fill="#5a5a5a" />
          </G>
        );
      })}
      {nodes.map((sp, i) => {
        const t = cardByName(sp.name);
        const accent = t ? (TROPHIC_COLOR[t.trophic] || '#8fa08f') : '#8fa08f';
        const nph = t ? photoFor(t.id, 120) : undefined;
        const cid = `${inst}n${i}`;
        const lines = fwWrap(sp.name);
        const lh = fontSize + 1, pad = Math.round(nodeR * 0.6);
        const rec = sp.evidence ? `${sp.evidence} records` : '';
        // THE NAME IS ALWAYS ABOVE THE HEXAGON and the coloured group word below it (user,
        // 2026-11-17: "make it so the name is always on top and the color word on bottom"). In the
        // lower half of the web they used to be the other way round, mirroring the upper half.
        const sdy = -(nodeR + pad) - (lines.length - 1) * lh - (rec ? lh : 0);
        const hex = nph ? (
          <>
            <Defs><ClipPath id={cid}><Polygon points={hexPts(sp.x, sp.y, nodeR)} /></ClipPath></Defs>
            <Polygon points={hexPts(sp.x, sp.y, nodeR)} fill="#1a1a1a" />
            <SvgImage href={{ uri: nph }} x={sp.x - nodeR} y={sp.y - nodeR} width={nodeR * 2} height={nodeR * 2}
              preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} />
            <Polygon points={hexPts(sp.x, sp.y, nodeR)} fill="none" stroke={accent} strokeWidth={showLabels ? 2 : 1.2} strokeLinejoin="round" />
          </>
        ) : (
          <Polygon points={hexPts(sp.x, sp.y, nodeR)}
            fill={t ? accent : '#444'} stroke={t ? '#1a1a1a' : accent} strokeWidth={1} strokeLinejoin="round" opacity={t ? 1 : 0.85} />
        );
        return (
          <G key={`n${i}`} {...pressProps(t && onNodePress ? () => onNodePress(t.id) : undefined)}>
            {hex}
            {showLabels && (
              <>
                <SvgText x={sp.x} y={sp.y + sdy} textAnchor="middle" fontSize={fontSize} fill="#888888"
                  fontFamily={F.sansMed} fontWeight="600">
                  {lines.map((l, li) => <TSpan key={li} x={sp.x} dy={li > 0 ? lh : 0}>{l}</TSpan>)}
                  {!!rec && <TSpan x={sp.x} dy={lh} fontSize={fontSize - 3} fill="#5a5a5a" fontWeight="400">{rec}</TSpan>}
                </SvgText>
                {!!t && (
                  <SvgText x={sp.x} y={sp.y + nodeR + pad + fontSize - 3}
                    textAnchor="middle" fontSize={fontSize - 2} fill={accent} fontFamily={F.sansBold} fontWeight="700">
                    {t.group}
                  </SvgText>
                )}
              </>
            )}
          </G>
        );
      })}
      <Defs><ClipPath id={`${inst}f`}><Polygon points={hexPts(cx, cy, centerR)} /></ClipPath></Defs>
      {focalPhoto ? (
        <>
          <Polygon points={hexPts(cx, cy, centerR)} fill="#1a1a1a" />
          <SvgImage href={{ uri: focalPhoto }} x={cx - centerR} y={cy - centerR} width={centerR * 2} height={centerR * 2}
            preserveAspectRatio="xMidYMid slice" clipPath={`url(#${inst}f)`} />
          <Polygon points={hexPts(cx, cy, centerR)} fill="none" stroke={tc} strokeWidth={3} strokeLinejoin="round" />
        </>
      ) : (
        <Polygon points={hexPts(cx, cy, centerR)} fill={tc} stroke={tc} strokeWidth={3} strokeLinejoin="round" />
      )}
    </Svg>
  );
}
