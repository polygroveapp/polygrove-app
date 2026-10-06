// the hexes / list switch (user, 2026-10-06)

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../constants/polygrove';
import { ViewMode } from '../lib/viewmode';

export default function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <View style={s.wrap}>
      {(['hex', 'list'] as ViewMode[]).map(m => (
        <Pressable key={m} onPress={() => onChange(m)} hitSlop={6} style={[s.btn, mode === m && s.btnOn]}>
          <Text style={[s.txt, mode === m && s.txtOn]}>{m === 'hex' ? '⬡ Hexes' : '☰ List'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignSelf: 'center', borderRadius: 14, padding: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: '#2a2a2a', gap: 2 },
  btn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 11 },
  btnOn: { backgroundColor: 'rgba(76,175,80,0.22)' },
  txt: { fontFamily: F.sansBold, fontSize: 11.5, color: '#888' },
  txtOn: { color: C.greenSoft },
});
