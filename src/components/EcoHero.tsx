// THE ECOREGION HERO on home (user, 2026-09-28: "for each home page put the
// photo of the ecoregion and description and place on the map"): the site's
// ecoregion-page header on the phone — Wikipedia lead photo, the region's
// place on the globe (the picker page in ?mini mode, non-interactive), the
// first sentence, and the credit. Tapping it opens the map.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { F } from '../constants/polygrove';
import { cleanLead, CurrentEco, ecoMeta, loadEcoMeta } from '../lib/ecoregions';

const MINI_URL = 'https://polygrovedb.pages.dev/map?mini=';

export default function EcoHero({ eco }: { eco: CurrentEco }) {
  const router = useRouter();
  // regions chosen before lead/photo were stored with the choice: fetch them
  const stored = !!(eco.lead || eco.photo);
  const [fetched, setFetched] = useState<{ eid: number; lead?: string; photo?: CurrentEco['photo'] } | null>(null);
  const [mapOk, setMapOk] = useState(true);
  useEffect(() => {
    if (stored) return;
    let live = true;
    loadEcoMeta().then(() => { const m = ecoMeta(eco.eid); if (live && m) setFetched({ eid: eco.eid, lead: m.lead, photo: m.photo }); }).catch(() => {});
    return () => { live = false; };
  }, [eco.eid, stored]);
  const meta = stored ? { lead: eco.lead, photo: eco.photo } : fetched?.eid === eco.eid ? fetched : {};

  return (
    <Pressable onPress={() => router.push('/map')} style={s.card}>
      <View style={s.row}>
        {meta.photo ? (
          <Image source={{ uri: meta.photo.thumb }} style={[s.pane, s.photo]} contentFit="cover" transition={250} cachePolicy="disk" />
        ) : (
          <View style={[s.pane, s.photo, s.center]}><Text style={s.noPhoto}>🌿</Text></View>
        )}
        {mapOk && (
          <View style={[s.pane, s.map]} pointerEvents="none">
            <WebView key={eco.eid} source={{ uri: MINI_URL + eco.eid }} style={s.web} onError={() => setMapOk(false)}
              scrollEnabled={false} bounces={false} javaScriptEnabled scalesPageToFit={false} originWhitelist={['https://*']} />
          </View>
        )}
      </View>
      {meta.lead ? <Text style={s.lead} numberOfLines={3}>{cleanLead(meta.lead)}</Text> : null}
      <Text style={s.credit} numberOfLines={1}>
        {meta.photo?.by ? `Wikipedia · photo ${meta.photo.by} (${meta.photo.lic})` : meta.lead ? 'Wikipedia' : 'No Wikipedia article for this ecoregion yet'}
        <Text style={{ color: '#4f7a52' }}>  ·  open the map ›</Text>
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(129,199,132,0.22)', backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 10, gap: 8, marginBottom: 20,
  },
  row: { flexDirection: 'row', gap: 8 },
  pane: { flex: 1, height: 118, borderRadius: 12, overflow: 'hidden', backgroundColor: '#132013' },
  photo: { borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  map: { backgroundColor: '#0b1a29', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  web: { flex: 1, backgroundColor: '#0b1a29' },
  center: { alignItems: 'center', justifyContent: 'center' },
  noPhoto: { fontSize: 30 },
  lead: { fontFamily: F.sans, fontSize: 12.5, color: '#c9c4b8', lineHeight: 17.5, paddingHorizontal: 2 },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#666', paddingHorizontal: 2 },
});
