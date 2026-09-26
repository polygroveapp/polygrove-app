// The demo's fixed bottom tab bar: ⛺ Home · 🌲 Species · ❓ About (home mock,
// 2026-09-26; tent instead of the demo's house per user). Plain buttons over
// expo-router — the stack stays simple.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../constants/polygrove';

const TABS = [
  { id: 'home', icon: '⛺', label: 'Home', href: '/' },
  { id: 'species', icon: '🌲', label: 'Species', href: '/deck' },
  { id: 'about', icon: '❓', label: 'About', href: '/about' },
] as const;

export type Tab = typeof TABS[number]['id'];

export default function BottomNav({ active }: { active: Tab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + 8 }]}>
      {TABS.map(t => (
        <Pressable key={t.id} onPress={() => { if (t.id !== active) router.replace(t.href); }}
          style={[s.tab, t.id === active && s.tabOn]}>
          <Text style={s.icon}>{t.icon}</Text>
          <Text style={[s.label, t.id === active && s.labelOn]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// space for screens to leave under their scroll content
export const NAV_HEIGHT = 64;

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: C.bg,
  },
  tab: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 14, minWidth: 92 },
  tabOn: { backgroundColor: 'rgba(255,255,255,0.06)' },
  icon: { fontSize: 22, lineHeight: 26 },
  label: { fontFamily: F.sansBold, fontSize: 11.5, color: '#888', marginTop: 2 },
  labelOn: { color: C.text },
});
