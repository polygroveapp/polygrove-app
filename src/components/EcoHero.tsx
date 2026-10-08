// THE ECOREGION HERO on home (user, 2026-09-28: "for each home page put the
// photo of the ecoregion and description and place on the map"): the site's
// ecoregion-page header on the phone — the region's place on the globe (the
// picker page in ?mini mode, non-interactive) left, Wikipedia lead photo
// right, the first sentence, and the credit. Sits under the stats row.
// Tapping the card opens the ecoregion's WIKIPEDIA article (user, 2026-09-28);
// "open the map ›" is its own small link.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { openWeb } from '../lib/web';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebFrame as WebView } from './WebFrame';
import { F } from '../constants/polygrove';
import { cleanLead, CurrentEco, ecoMeta, loadEcoMeta, wikiUrl } from '../lib/ecoregions';
import { MINI_VERSION, saveMiniMap, useMiniMap } from '../lib/minimap';

const MINI_URL = 'https://polygrovedb.pages.dev/map?mini=';
// the page's address carries the picture version, and the WebView keeps no cache: a redraw must
// never come from a stale copy of the page (2026-10-07: v7 pictures were redrawn from an old one)

export default function EcoHero({ eco }: { eco: CurrentEco }) {
  const router = useRouter();
  // the site's metadata wins whenever it can be fetched (descriptions get
  // better — the second sentence replaced the first on 2026-09-29); what was
  // stored with the choice is the offline fallback
  const [fetched, setFetched] = useState<{ eid: number; lead?: string; photo?: CurrentEco['photo']; wiki?: string } | null>(null);
  const [mapOk, setMapOk] = useState(true);
  const snap = useMiniMap(eco.eid);
  useEffect(() => {
    let live = true;
    loadEcoMeta().then(() => { const m = ecoMeta(eco.eid); if (live && m) setFetched({ eid: eco.eid, lead: m.lead, photo: m.photo, wiki: m.wiki }); }).catch(() => {});
    return () => { live = false; };
  }, [eco.eid]);
  const f = fetched?.eid === eco.eid ? fetched : undefined;
  const meta = { lead: f?.lead ?? eco.lead, photo: f?.photo ?? eco.photo, wiki: f?.wiki ?? eco.wiki };
  // no article title known → Wikipedia's own search on the ecoregion name
  const openWiki = () => openWeb(meta.wiki ? wikiUrl(meta.wiki) : wikiUrl(eco.name));

  return (
    <Pressable onPress={openWiki} style={s.card}>
      {/* map on the LEFT, photo on the right (user, 2026-09-28) */}
      <View style={s.row}>
        {/* ALWAYS LOADED (user, 2026-09-29): the first visit draws the map in
            a WebView, which hands back a picture of itself; from then on the
            picture shows at once — no page, no network */}
        {snap ? (
          <Image source={{ uri: snap }} style={[s.pane, s.map]} contentFit="cover" />
        ) : mapOk && (
          <View style={[s.pane, s.map]} pointerEvents="none">
            <WebView key={eco.eid} source={{ uri: `${MINI_URL}${eco.eid}&v=${MINI_VERSION}` }} cacheEnabled={false} style={s.web} onError={() => setMapOk(false)}
              onMessage={e => {
                try {
                  const m = JSON.parse(e.nativeEvent.data);
                  if (m.type === 'snapshot' && m.eid === eco.eid && typeof m.data === 'string' && m.data.length > 5000) saveMiniMap(eco.eid, m.data);
                } catch { /* not ours */ }
              }}
              scrollEnabled={false} bounces={false} javaScriptEnabled scalesPageToFit={false} originWhitelist={['https://*']} />
          </View>
        )}
        {meta.photo ? (
          <Image source={{ uri: meta.photo.thumb }} style={[s.pane, s.photo]} contentFit="cover" transition={250} cachePolicy="disk" />
        ) : (
          <View style={[s.pane, s.photo, s.center]}><Text style={s.noPhoto}>🌿</Text></View>
        )}
      </View>
      {meta.lead ? <Text style={s.lead} numberOfLines={3}>{cleanLead(meta.lead)}</Text> : null}
      <View style={s.foot}>
        <Text style={s.credit} numberOfLines={1}>
          {meta.photo?.by ? `Wikipedia · photo ${meta.photo.by} (${meta.photo.lic})` : meta.lead ? 'Read on Wikipedia ›' : 'No Wikipedia article for this ecoregion yet'}
        </Text>
        <Pressable onPress={() => router.push('/map')} hitSlop={8}><Text style={s.mapLink}>open the map ›</Text></Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(129,199,132,0.22)', backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 10, gap: 8, marginBottom: 12,   // a little closer to the buttons below (user, 2026-09-29)
  },
  row: { flexDirection: 'row', gap: 8 },
  pane: { flex: 1, height: 118, borderRadius: 12, overflow: 'hidden', backgroundColor: '#132013' },
  photo: { borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  map: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: 'rgba(129,199,132,0.25)' },
  web: { flex: 1, backgroundColor: '#0d0d0d' },
  center: { alignItems: 'center', justifyContent: 'center' },
  noPhoto: { fontSize: 30 },
  lead: { fontFamily: F.sans, fontSize: 12.5, color: '#c9c4b8', lineHeight: 17.5, paddingHorizontal: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2 },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#666', flexShrink: 1 },
  mapLink: { fontFamily: F.sansBold, fontSize: 10, color: '#4f7a52' },
});
