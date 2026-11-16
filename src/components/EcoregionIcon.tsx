// AN ECOREGION AS THE MAP DRAWS IT (user, 2026-11-16): an irregular region with
// the map's glowing pale-green border over a dark fill, a small
// irregular patch of land. Used where a label needs an icon for "Ecoregion".

import { Path, Svg } from 'react-native-svg';

const REGION = 'M5 4.2 L8.4 2.6 L11.6 3.6 L13 5.8 L16.2 6.6 L17.4 9.6 L15.8 12.2 L16.8 15 L14 17.2 L10.8 16.2 L8.2 17.6 L5.4 15.8 L4.8 12.8 L2.8 10.2 L3.8 7 Z';

export default function EcoregionIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      {/* the glow, then the region and its bright edge */}
      <Path d={REGION} fill="none" stroke="rgba(129,199,132,0.35)" strokeWidth={3} strokeLinejoin="round" />
      <Path d={REGION} fill="rgba(60,110,60,0.35)" stroke="#b9e6a8" strokeWidth={1.3} strokeLinejoin="round" />
    </Svg>
  );
}
