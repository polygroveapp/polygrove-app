// THE close button, everywhere (user, 2026-09-29: "make all the x close
// things in the app in the top right with just an X"): a round ✕ in the
// top-right corner — no label, one look, one place.
// In DEVELOPMENT only it sits a little to the left: Expo's gear floats on
// that corner of the simulator and would swallow the tap. Shipped builds
// have no gear and the ✕ sits in the corner.

import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/polygrove';

export default function CloseX({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
      style={[s.x, { top: insets.top + 8, right: __DEV__ ? 78 : 16 }]}>
      <Text style={s.txt}>✕</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  x: {
    position: 'absolute', zIndex: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  txt: { color: C.text, fontSize: 15, lineHeight: 18 },
});
