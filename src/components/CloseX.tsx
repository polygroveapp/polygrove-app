// THE close button, everywhere (user, 2026-09-29: "make all the x close
// things in the app in the top right with just an X"): a round ✕ in the
// top-right corner — no label, one look, one place.
// In the corner even in development (user, 2026-10-06: "all these x's should
// be in the top right") — Expo's gear floats near it on the simulator, but
// the ✕ is where it will be in the shipped app.

import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BTN_BG, BTN_BORDER, C } from '../constants/polygrove';

export default function CloseX({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close"
      style={[s.x, { top: insets.top + 8, right: 16 }]}>
      <Text style={s.txt}>✕</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  x: {
    position: 'absolute', zIndex: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: BTN_BG, borderWidth: 1, borderColor: BTN_BORDER,   // the default button (was a faint white glass)
    alignItems: 'center', justifyContent: 'center',
  },
  txt: { color: C.text, fontSize: 15, lineHeight: 18 },
});
