// The frosted pill behind the tab bar and the segmented switches: the same blurred glass on
// every platform. (For a few hours on 2026-11-17 the web got a plain fill instead: the tab
// bar was reported "glitching sometimes" and the backdrop blur was blamed. The real cause
// was the compass icon's shared gradient ids — see CompassIcon — so the blur is back.
// `webFill` is kept on the callers in case a plain fill is ever wanted again.)

import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';

export default function GlassTrack({ style, onLayout, children }: {
  style?: StyleProp<ViewStyle>; webFill?: string; onLayout?: (e: LayoutChangeEvent) => void; children: ReactNode;
}) {
  return <BlurView intensity={28} tint="dark" blurMethod="dimezisBlurView" style={style} onLayout={onLayout}>{children}</BlurView>;
}
