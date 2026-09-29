// The demo's popup (App.jsx .modal-overlay): the screen dims and blurs, and a
// dark glass card FADES IN WHILE SLIDING UP — modalFadeIn / modalSlideIn,
// 0.6s ease, from 16px low and 97% size — then leaves the same way in 0.28s.
// Used for the pack tips; the card's content is the caller's.

import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export default function TipCard({ visible, children, maxWidth = 340 }: { visible: boolean; children: React.ReactNode; maxWidth?: number }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      setMounted(true);   // eslint-disable-line react-hooks/set-state-in-effect
      t.value = withTiming(1, { duration: 600, easing: EASE });
    } else {
      t.value = withTiming(0, { duration: 280, easing: EASE }, done => { if (done) runOnJS(setMounted)(false); });
    }
  }, [visible, t]);
  const overlay = useAnimatedStyle(() => ({ opacity: t.value }));
  const card = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: 16 * (1 - t.value) }, { scale: 0.97 + 0.03 * t.value }],
  }));
  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.overlay, overlay]}>
        <BlurView intensity={22} tint="dark" blurMethod="dimezisBlurView" style={[s.fill, { paddingTop: insets.top + 40 }]}>
          <View style={s.dim} />
          <Animated.View style={[s.card, { maxWidth }, card]}>{children}</Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1 },
  fill: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingBottom: 28 },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    width: '100%', backgroundColor: 'rgba(20,30,20,0.92)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 28, paddingHorizontal: 24,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 40, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
});
