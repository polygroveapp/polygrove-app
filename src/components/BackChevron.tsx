// THE back button (user, 2026-10-06: "a back button in the top left to go
// back to camp"): CloseX's twin on the other corner, a ‹ that returns.

import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BTN_BG, BTN_BORDER, C } from '../constants/polygrove';

export default function BackChevron({ onPress, label }: { onPress: () => void; label?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={label ?? 'Back'}
      style={[s.b, { top: insets.top + 8, left: 16 }]}>
      <Text style={s.txt}>‹</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  b: {
    position: 'absolute', zIndex: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: BTN_BG, borderWidth: 1, borderColor: BTN_BORDER,   // the default button (was a faint white glass)
    alignItems: 'center', justifyContent: 'center',
  },
  txt: { color: C.text, fontSize: 24, lineHeight: 26, marginTop: -3, marginLeft: -1 },
});
