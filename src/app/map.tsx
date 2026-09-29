// THE MAP TAB's route. The map itself is components/MapOverlay — mounted once
// in the root layout and kept alive (user, 2026-09-29), shown while this route
// is the current one. This screen is only the backdrop underneath it.

import { View } from 'react-native';

export default function MapRoute() {
  return <View style={{ flex: 1, backgroundColor: '#0b1a29' }} />;
}
