// THE RANGE MAP on a species page (user, 2026-10-06: "add all the charts and
// maps"): the map page in range mode — every ecoregion the species is recorded
// in, filled by its share of records, the ✕ cells where it was seen — as a
// still picture in the page; ⛶ opens it full screen and pannable.

import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebFrame as WebView } from './WebFrame';
import { C, F } from '../constants/polygrove';
import { DB_SITE } from '../constants/site';

const URL = (sci: string, live: boolean) => `${DB_SITE}/map?range=${encodeURIComponent(sci)}${live ? '&live=1' : ''}`;

export default function RangeMap({ sci, height = 230 }: { sci: string; height?: number }) {
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.box, { height }]}>
      <WebView source={{ uri: URL(sci, false) }} style={s.web} scrollEnabled={false} pointerEvents="none"
        onMessage={e => { try { if (JSON.parse(e.nativeEvent.data).type === 'range-ready') setReady(true); } catch { /* not ours */ } }} />
      {!ready ? <View style={s.loading}><ActivityIndicator color={C.green} /></View> : null}
      <Pressable onPress={() => setFull(true)} hitSlop={8} style={s.fullBtn} accessibilityRole="button" accessibilityLabel="Full screen map">
        <Text style={s.fullTxt}>⛶</Text>
      </Pressable>
      <Modal visible={full} animationType="fade" onRequestClose={() => setFull(false)}>
        <View style={{ flex: 1, backgroundColor: '#0d0d0d' }}>
          <WebView source={{ uri: URL(sci, true) }} style={{ flex: 1 }} />
          <Pressable onPress={() => setFull(false)} hitSlop={12} style={[s.x, { top: insets.top + 8 }]} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={s.xTxt}>✕</Text>
          </Pressable>
          <Text style={[s.credit, { bottom: insets.bottom + 8 }]}>RESOLVE Ecoregions 2017 (CC-BY 4.0) · ✕ GBIF occurrences (CC0/CC-BY)</Text>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  web: { flex: 1, backgroundColor: '#0d0d0d' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d' },
  fullBtn: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  fullTxt: { color: '#ddd', fontSize: 15, lineHeight: 18 },
  x: { position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  xTxt: { color: C.text, fontSize: 15, lineHeight: 18 },
  credit: { position: 'absolute', left: 16, right: 16, fontFamily: F.sans, fontSize: 9.5, color: '#777', textAlign: 'center' },
});
