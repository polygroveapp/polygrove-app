// The Map tab's compass (user, 2026-09-29). There is no brown or gold compass
// emoji — 🧭 is silver — so this one is drawn: a brass-gold case, a dial
// tinted BROWN rather than white, and the needle that makes it a compass at a
// glance: RED to the north, BLACK to the south.

import { Circle, Line, Polygon, Svg } from 'react-native-svg';

export default function CompassIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* the ring the compass hangs by */}
      <Circle cx="12" cy="2.6" r="1.5" fill="none" stroke="#a9832a" strokeWidth="1.1" />
      {/* case and dial */}
      <Circle cx="12" cy="13" r="9.6" fill="#d4a93c" />
      <Circle cx="12" cy="13" r="9.6" fill="none" stroke="#8a6a1f" strokeWidth="0.9" />
      {/* the dial: muted, with a brown tint — not white */}
      <Circle cx="12" cy="13" r="7.4" fill="#b89a7c" />
      {/* the four points */}
      {[0, 90, 180, 270].map(a => (
        <Line key={a} x1="12" y1="6.3" x2="12" y2="7.6" stroke="#5e3522" strokeWidth="0.9" strokeLinecap="round"
          transform={`rotate(${a} 12 13)`} />
      ))}
      {/* the needle, turned a little east of north */}
      <Polygon points="12,6.6 14.1,13 9.9,13" fill="#d32f2f" transform="rotate(32 12 13)" />
      <Polygon points="12,19.4 14.1,13 9.9,13" fill="#151515" transform="rotate(32 12 13)" />
      <Circle cx="12" cy="13" r="1.1" fill="#e9dcc6" />
    </Svg>
  );
}
