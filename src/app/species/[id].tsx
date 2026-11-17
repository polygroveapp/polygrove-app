// A SPECIES PAGE FOR THE PHONE (user, 2026-10-06: "a species page that has
// all the information that's provided on the website, but just for a phone,
// in this order"): name and group · the card · Range (top ecoregions by
// records, one at a time) · Climate · Diet (GloBI) · Everything in the
// database · Provenance. Reached from the PolygroveDB tab, a food-web node,
// or a deep link. The data is the same the website reads: the catalog, the
// dossier shards, the range shards and the ecoregion metadata.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCardSize } from '../../lib/cardSize';
import BackChevron from '../../components/BackChevron';
import GreenBackdrop, { GREEN_BG } from '../../components/GreenBackdrop';
import PolygroveCard from '../../components/PolygroveCard';
import QuizButton from '../../components/QuizButton';
import RangeMap from '../../components/RangeMap';
import SeasonStrip from '../../components/SeasonStrip';
import { C, F, TROPHIC_COLOR } from '../../constants/polygrove';
import { cardById, getCards, inatPhotoOf, loadCatalog } from '../../lib/catalog';
import { DossierSection, Seasonality, dossierSections, rangeOf, seasonalityOf } from '../../lib/dossier';
import { EcoMeta, ecoMeta, loadEcoMeta } from '../../lib/ecoregions';
import { offlineReady } from '../../lib/offline';
import { openWeb } from '../../lib/web';

const CONF_COLOR: Record<string, string> = { measured: '#66bb6a', definitional: '#64b5f6', derived: '#ffb74d', inferred: '#e57373' };
type Climate = { tempC?: number | null; precipMm?: number | null; zone?: string | null };
type DietItem = { category: string; share?: number | null; source?: string };

export default function Species() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cardSize = useCardSize(true);   // the one card size (lib/cardSize); the page scrolls, so it is never shrunk
  const [ready, setReady] = useState(getCards().length > 0);
  useEffect(() => {
    // a deep link lands here cold: load the catalog ourselves; offline
    // snapshots register journaled cards so this works with no signal
    Promise.allSettled([offlineReady(), loadCatalog(), loadEcoMeta()]).then(() => setReady(true));
  }, []);
  const card = ready ? cardById(String(id)) : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/db'));

  // the long-tail data, fetched once the card is known
  const sci = card?.sci;
  // each result remembers which species it is for, so a stale one reads as
  // "loading" rather than being cleared in the effect
  type RangeItem = { eid: number; pm: number; meta: EcoMeta };
  const [rangeFor, setRangeFor] = useState<{ sci: string; items: RangeItem[] } | null>(null);
  const [dossierFor, setDossierFor] = useState<{ sci: string; d: { globi: DossierSection[]; rest: DossierSection[] } } | null>(null);
  useEffect(() => {
    if (!sci) return;
    let on = true;
    rangeOf(sci).then(r => { if (on) setRangeFor({ sci, items: r.map(([eid, pm]) => ({ eid, pm, meta: ecoMeta(eid)! })).filter(x => x.meta) }); }).catch(() => { if (on) setRangeFor({ sci, items: [] }); });
    dossierSections(sci).then(d => { if (on) setDossierFor({ sci, d }); }).catch(() => { if (on) setDossierFor({ sci, d: { globi: [], rest: [] } }); });
    return () => { on = false; };
  }, [sci]);
  const cardId = card?.id;
  const [seasFor, setSeasFor] = useState<{ id: string; d: Seasonality | null } | null>(null);
  useEffect(() => {
    if (!cardId) return;
    let on = true;
    seasonalityOf(cardId).then(d => { if (on) setSeasFor({ id: cardId, d }); }).catch(() => { if (on) setSeasFor({ id: cardId, d: null }); });
    return () => { on = false; };
  }, [cardId]);
  const seas = seasFor && seasFor.id === cardId ? seasFor.d : undefined;
  const range = rangeFor && rangeFor.sci === sci ? rangeFor.items : null;
  const dossier = dossierFor && dossierFor.sci === sci ? dossierFor.d : null;
  const [pageFor, setPageFor] = useState<{ sci: string; page: number }>({ sci: '', page: 0 });
  const page = pageFor.sci === sci ? pageFor.page : 0;
  const setPage = (f: (p: number) => number) => setPageFor(prev => ({ sci: sci ?? '', page: f(prev.sci === sci ? prev.page : 0) }));

  if (!ready) return <View style={[s.root, s.center]}><GreenBackdrop /><ActivityIndicator color={C.green} /></View>;
  if (!card) return (
    <View style={[s.root, s.center]}>
      <GreenBackdrop /><BackChevron onPress={back} />
      <Text style={s.msg}>That species isn’t in the database.</Text>
    </View>
  );

  const tc = TROPHIC_COLOR[card.trophic] || C.greenSoft;   // the group label wears the role colour, like the card's border (user, 2026-10-06: 'mammal is yellow')
  const climate = card.climate as Climate | undefined;
  const diet = (card.diet as DietItem[] | undefined) ?? [];
  const prov = card.provenance ?? {};
  const cur = range && range.length ? range[Math.min(page, range.length - 1)] : null;
  const pct = (pm: number) => (pm >= 10 ? `${(pm / 10).toFixed(0)}%` : '<1%');

  return (
    <View style={s.root}>
      <GreenBackdrop />
      <BackChevron onPress={back} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
        {/* 1 · the name, the scientific name, the group */}
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{card.name}</Text>
            <Text style={s.sci}>{card.sci}</Text>
          </View>
          <Text style={[s.group, { color: tc }]}>{card.group.toUpperCase()}</Text>
        </View>

        {/* 2 · the card itself */}
        <View style={[cardSize, { alignSelf: 'center', marginTop: 14 }]}><PolygroveCard card={card} dbPhoto /></View>
        {/* an iNaturalist fill-in photo is credited in the open, as CC BY asks (user, 2026-10-08: "don't we run into licensing issues") */}
        {(() => { const ip = inatPhotoOf(card.id); return ip ? (
          <Pressable onPress={() => openWeb(ip.page)}><Text style={[s.credit, { textAlign: 'center', marginTop: 8 }]}>photo{ip.by && ip.by !== 'no rights reserved' ? `: ${ip.by}` : ''} · {ip.lic} · iNaturalist ›</Text></Pressable>
        ) : null; })()}
        {/* PolygroveDB quizzes are practice (user, 2026-10-18: "take practice quiz too for the database") */}
        <QuizButton card={card} practice style={{ marginTop: 16, width: cardSize.width, alignSelf: 'center' }} />

        {/* 3 · Range — the map, then the top ecoregions by records, one panel at a time */}
        <H3 title="Range" />
        <RangeMap sci={card.sci} />
        <Text style={[s.dim, { marginTop: 6, marginBottom: 12, fontSize: 10 }]}>RESOLVE Ecoregions 2017 (CC-BY 4.0) · ✕ GBIF occurrences (CC0/CC-BY) · fill by share of records</Text>
        {range === null ? <ActivityIndicator color={C.green} style={{ marginVertical: 20 }} />
          : !cur ? <Text style={s.dim}>No ecoregion records yet.</Text> : (
          <>
            <Text style={s.label}>TOP ECOREGIONS — BY RECORDS</Text>
            <EcoPanel item={cur} pct={pct(cur.pm)} onOpen={() => router.push({ pathname: '/deck', params: { eid: String(cur.eid), slide: 'right' } })} />
            {range.length > 1 ? (
              <View style={s.pager}>
                <Pressable onPress={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} hitSlop={8} style={s.pagerBtn}><Text style={[s.pagerTxt, page === 0 && { opacity: 0.3 }]}>‹</Text></Pressable>
                <Text style={s.dim}>{page + 1} of {range.length} ecoregions · by records</Text>
                <Pressable onPress={() => setPage(p => Math.min(range.length - 1, p + 1))} disabled={page >= range.length - 1} hitSlop={8} style={s.pagerBtn}><Text style={[s.pagerTxt, page >= range.length - 1 && { opacity: 0.3 }]}>›</Text></Pressable>
              </View>
            ) : null}
          </>
        )}

        {/* 4 · Climate */}
        {climate && (climate.tempC != null || climate.precipMm != null || climate.zone) ? (
          <>
            <H3 title="Climate" src={climate.tempC != null ? 'range average — TetrapodTraits' : 'WCVP'} />
            <View style={s.chipRow}>
              {climate.tempC != null ? <Chip>🌡 {climate.tempC}°C / {(climate.tempC * 9 / 5 + 32).toFixed(1)}°F mean annual</Chip> : null}
              {climate.precipMm != null ? <Chip>🌧 {climate.precipMm.toLocaleString()} mm / {(climate.precipMm / 25.4).toFixed(1)} in rain a year</Chip> : null}
              {climate.zone ? <Chip>{climate.zone}</Chip> : null}
            </View>
          </>
        ) : null}

        {/* 4½ · Seasonality — when it is reported, by month */}
        {seas ? (
          <>
            <H3 title="Seasonality" src={`${seas.n.toLocaleString()} records, this species’ ecoregions`} />
            <SeasonStrip data={seas} />
          </>
        ) : null}

        {/* 5 · Diet — the catalog's items, then every GloBI record */}
        <H3 title="Diet" src={diet.length ? `${diet[0].source ?? ''}${diet[0].share != null ? ', measured proportions' : ', recorded diet items'}` : undefined} />
        {diet.length ? <View style={s.chipRow}>{diet.map((d, i) => <Chip key={i}>{d.category}{d.share != null ? ` · ${Math.round(d.share * 100)}%` : ''}</Chip>)}</View> : null}
        {dossier === null ? <ActivityIndicator color={C.green} style={{ marginVertical: 12 }} />
          : dossier.globi.length ? dossier.globi.map(sec => <Section key={sec.source} sec={sec} />)
          : !diet.length ? <Text style={s.dim}>No diet records.</Text> : null}

        {/* 6 · Everything in the database */}
        <H3 title="Everything in the database" />
        {dossier === null ? null : dossier.rest.length ? dossier.rest.map(sec => <Section key={sec.source} sec={sec} />) : <Text style={s.dim}>No additional records.</Text>}

        {/* 7 · Provenance */}
        <H3 title="Provenance" />
        <View style={s.table}>
          {Object.entries(prov).map(([f, x]) => (
            <View key={f} style={s.tr}>
              <Text style={[s.td, { flex: 0.9 }]}>{f}</Text>
              <Text style={[s.td, { flex: 1.4 }]}>{x.source || '—'}</Text>
              <Text style={[s.td, s.conf, { flex: 0.9, color: CONF_COLOR[x.confidence] || '#888' }]}>{x.confidence || ''}</Text>
            </View>
          ))}
        </View>
        <Pressable onPress={() => openWeb(`https://polygrovedb.pages.dev/#${card.id}`)} hitSlop={8} style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={s.link}>This species on polygrovedb.pages.dev ›</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function H3({ title, src }: { title: string; src?: string }) {
  return (
    <View style={s.h3Row}>
      <Text style={s.h3}>{title}</Text>
      {src ? <Text style={s.h3Src} numberOfLines={1}>{src}</Text> : null}
    </View>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <View style={s.chip}><Text style={s.chipTxt}>{children}</Text></View>;
}
function Section({ sec }: { sec: DossierSection }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.h4}>{sec.source} <Text style={s.h4N}>· {sec.rows.length}</Text></Text>
      <View style={s.table}>
        {sec.rows.map((r, i) => (
          <View key={i} style={s.tr}>
            <Text style={[s.td, { flex: 0.9 }]}>{r.fact}</Text>
            <Text style={[s.td, { flex: 1.4 }]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
// one ecoregion the species is recorded in: photo, name, share of records, lead
function EcoPanel({ item, pct, onOpen }: { item: { eid: number; pm: number; meta: EcoMeta }; pct: string; onOpen: () => void }) {
  const m = item.meta;
  return (
    <Pressable onPress={onOpen} style={s.eco}>
      {m.photo?.thumb ? <Image source={{ uri: m.photo.thumb }} style={s.ecoPhoto} resizeMode="cover" /> : null}
      <View style={{ padding: 12, gap: 6 }}>
        <Text style={s.ecoName}>{m.name}</Text>
        <View style={{ flexDirection: 'row' }}><View style={s.pctChip}><Text style={s.pctTxt}>{pct} of records</Text></View></View>
        {m.lead ? <Text style={s.ecoLead} numberOfLines={3}>{m.lead}</Text> : null}
        {m.photo ? <Text style={s.credit} numberOfLines={1}>photo{m.photo.by ? `: ${m.photo.by}` : ''} · {m.photo.lic}</Text> : null}
        <Text style={s.link}>Its journal ›</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontFamily: F.display, fontSize: 30, color: C.text, lineHeight: 36 },
  sci: { fontFamily: F.sans, fontSize: 16, color: '#aaa', fontStyle: 'italic', marginTop: 4 },
  group: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, marginTop: 10 },
  h3Row: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 28, marginBottom: 8 },
  h3: { fontFamily: F.display, fontSize: 18, color: C.text },
  h3Src: { fontFamily: F.sans, fontSize: 11, color: '#777', flexShrink: 1 },
  h4: { fontFamily: F.display, fontSize: 14, color: C.text, marginBottom: 4 },
  h4N: { fontFamily: F.sans, fontSize: 13, color: C.greenSoft },
  label: { fontFamily: F.sansBold, fontSize: 10.5, color: '#777', letterSpacing: 1.6, marginBottom: 8 },
  dim: { fontFamily: F.sans, fontSize: 12, color: '#777' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(129,199,132,0.35)', backgroundColor: 'rgba(76,175,80,0.1)' },
  chipTxt: { fontFamily: F.sans, fontSize: 12.5, color: C.text },
  table: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  tr: { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  td: { fontFamily: F.sans, fontSize: 12.5, color: '#bbb', lineHeight: 17 },
  conf: { fontFamily: F.sansBold, textAlign: 'right' },
  eco: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(129,199,132,0.5)', backgroundColor: 'rgba(0,0,0,0.2)', overflow: 'hidden' },
  ecoPhoto: { width: '100%', height: 150 },
  ecoName: { fontFamily: F.display, fontSize: 17, color: C.greenSoft },
  pctChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(129,199,132,0.5)', backgroundColor: 'rgba(76,175,80,0.12)' },
  pctTxt: { fontFamily: F.sansMed, fontSize: 12, color: C.text },
  ecoLead: { fontFamily: F.sans, fontSize: 13, color: '#bbb', lineHeight: 18 },
  credit: { fontFamily: F.sans, fontSize: 10, color: '#777' },
  link: { fontFamily: F.sansBold, fontSize: 12, color: C.greenSoft },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 10 },
  pagerBtn: { width: 36, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#333' },
  pagerTxt: { fontFamily: F.sansBold, fontSize: 18, color: C.text },
});
