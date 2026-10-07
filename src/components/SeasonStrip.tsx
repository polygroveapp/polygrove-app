// SEASONALITY (the website's strip, for the phone): twelve bars for when the
// species is reported, raw or corrected for recording effort — raw shows when
// people report it; effort itself peaks in May (2.4× December), so the
// corrected view divides out how much people were looking.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../constants/polygrove';
import { Seasonality } from '../lib/dossier';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function SeasonStrip({ data }: { data: Seasonality }) {
  const [corr, setCorr] = useState(false);
  const v = corr ? data.corr : data.raw;
  const mx = Math.max(...v) || 1;
  const color = corr ? '#64b5f6' : C.green;
  return (
    <View>
      <View style={s.bars}>
        {v.map((x, i) => (
          <View key={i} style={s.col}>
            <View style={[s.bar, { height: Math.max(2, Math.round((x / mx) * 56)), backgroundColor: color, opacity: 0.45 + 0.55 * (x / mx) }]} />
          </View>
        ))}
      </View>
      <View style={s.bars}>{MONTHS.map((m, i) => <Text key={i} style={s.month}>{m}</Text>)}</View>
      <Pressable onPress={() => setCorr(c => !c)} hitSlop={6} style={s.toggle}>
        <View style={[s.check, corr && { backgroundColor: '#64b5f6', borderColor: '#64b5f6' }]}>{corr ? <Text style={s.tick}>✓</Text> : null}</View>
        <Text style={s.toggleTxt}>corrected for recording effort</Text>
      </Pressable>
      <Text style={s.note}>Raw bars show when people report it. Recording effort itself peaks in May (2.4× December); the corrected view divides out how much people were looking.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 64 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  month: { flex: 1, textAlign: 'center', fontFamily: F.sans, fontSize: 10, color: '#777', height: 16, lineHeight: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: '#666', alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#0d0d0d', fontSize: 11, lineHeight: 13, fontFamily: F.sansBold },
  toggleTxt: { fontFamily: F.sans, fontSize: 12, color: '#aaa' },
  note: { fontFamily: F.sans, fontSize: 11, color: '#777', lineHeight: 15, marginTop: 6 },
});
