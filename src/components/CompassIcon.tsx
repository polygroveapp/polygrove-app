// The Map tab's compass (user, 2026-09-29). There is no brown or gold compass
// emoji — 🧭 is silver — so this one is drawn: a brass-gold case, a dial
// tinted BROWN rather than white, and the needle that makes it a compass at a
// glance: RED to the north, BLACK to the south.
// Less flat (user, 2026-09-30, "looks a little cheap… more gold"): the case is
// a polished brass bevel — a gradient rim with a light edge and a shaded
// inner lip — the dial has a little depth, and the needle catches a highlight.

import { Circle, Defs, Line, Polygon, RadialGradient, Stop, Svg, LinearGradient } from 'react-native-svg';

export default function CompassIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        {/* brass: bright at the upper-left, deep at the lower-right */}
        <LinearGradient id="cBrass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffe9a3" />
          <Stop offset="0.45" stopColor="#e2b53f" />
          <Stop offset="1" stopColor="#8d6516" />
        </LinearGradient>
        {/* the same, reversed, for the inner lip — reads as a turned edge */}
        <LinearGradient id="cLip" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7a5612" />
          <Stop offset="1" stopColor="#f0cf6a" />
        </LinearGradient>
        {/* the dial: lit from above, darker toward the rim */}
        <RadialGradient id="cDial" cx="0.42" cy="0.35" r="0.75">
          <Stop offset="0" stopColor="#d3b697" />
          <Stop offset="1" stopColor="#8f7256" />
        </RadialGradient>
      </Defs>
      {/* the ring the compass hangs by */}
      <Circle cx="12" cy="2.5" r="1.4" fill="none" stroke="url(#cBrass)" strokeWidth="1.2" />
      {/* case: brass bevel, a dark seat line, then the inner lip */}
      <Circle cx="12" cy="13" r="9.8" fill="url(#cBrass)" />
      <Circle cx="12" cy="13" r="9.8" fill="none" stroke="#5c3f0c" strokeWidth="0.5" />
      <Circle cx="12" cy="13" r="8.2" fill="none" stroke="url(#cLip)" strokeWidth="0.8" />
      {/* the dial, with a shadow under the lip */}
      <Circle cx="12" cy="13" r="7.6" fill="url(#cDial)" />
      <Circle cx="12" cy="13" r="7.6" fill="none" stroke="#4a3018" strokeWidth="0.5" opacity="0.7" />
      {/* the four points, with lesser marks between */}
      {[0, 90, 180, 270].map(a => (
        <Line key={a} x1="12" y1="6.3" x2="12" y2="7.9" stroke="#4a2a18" strokeWidth="0.95" strokeLinecap="round"
          transform={`rotate(${a} 12 13)`} />
      ))}
      {[45, 135, 225, 315].map(a => (
        <Line key={a} x1="12" y1="6.3" x2="12" y2="7.2" stroke="#4a2a18" strokeWidth="0.6" strokeLinecap="round" opacity="0.8"
          transform={`rotate(${a} 12 13)`} />
      ))}
      {/* the needle, turned a little east of north, with a lit edge */}
      <Polygon points="12,6.4 14.2,13 9.8,13" fill="#c62828" transform="rotate(32 12 13)" />
      <Polygon points="12,6.4 12,13 9.8,13" fill="#ef5350" opacity="0.7" transform="rotate(32 12 13)" />
      <Polygon points="12,19.6 14.2,13 9.8,13" fill="#151515" transform="rotate(32 12 13)" />
      <Polygon points="12,19.6 12,13 9.8,13" fill="#3a3a3a" opacity="0.8" transform="rotate(32 12 13)" />
      {/* the hub: a brass pin */}
      <Circle cx="12" cy="13" r="1.35" fill="#5c3f0c" />
      <Circle cx="11.8" cy="12.8" r="0.9" fill="#ffe9a3" />
    </Svg>
  );
}
