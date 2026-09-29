// THE CAMP GREEN (user, 2026-09-29: "have all the pages have the same green
// background as the camp page"): the home screen's diagonal gradient, as the
// first child of every screen's root. GREEN_BG is the flat colour under it —
// for roots, and for opaque bars that content scrolls beneath.

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

export const GREEN_BG = '#0d140d';
export const GREEN_GRADIENT = ['#0a0f0a', '#1a2e1a', '#0f1a0f'] as const;

export default function GreenBackdrop() {
  return (
    <LinearGradient colors={GREEN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.fill} pointerEvents="none" />
  );
}

const s = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
