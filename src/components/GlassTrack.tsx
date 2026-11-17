// The frosted pill behind the tab bar and the segmented switches.
// ON THE WEB IT IS NOT BLURRED (user, 2026-11-17: "this is glitching sometimes" — the tab
// bar flashed as a square band with hard lines across the screen). A browser's backdrop
// blur sometimes ignores the pill's rounded clip while something inside it is moving (the
// green thumb gliding) or the page behind is scrolling, and paints the whole rectangle.
// A plain dark-glass fill cannot do that. iOS and Android keep the real blur.

import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { LayoutChangeEvent, Platform, StyleProp, View, ViewStyle } from 'react-native';

export default function GlassTrack({ style, webFill, onLayout, children }: {
  style?: StyleProp<ViewStyle>; webFill: string; onLayout?: (e: LayoutChangeEvent) => void; children: ReactNode;
}) {
  if (Platform.OS === 'web') return <View style={[style, { backgroundColor: webFill }]} onLayout={onLayout}>{children}</View>;
  return <BlurView intensity={28} tint="dark" blurMethod="dimezisBlurView" style={style} onLayout={onLayout}>{children}</BlurView>;
}
