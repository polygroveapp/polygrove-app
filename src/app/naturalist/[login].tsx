// AN ACCOUNT (Social, 2026-09-29): one iNaturalist naturalist — who they are,
// a Follow button (a bookmark kept on this phone), and what they have seen.
// Species that are cards in the deck can be bought for 10 Sol.

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CloseX from '../../components/CloseX';
import SightingRow from '../../components/SightingRow';
import { C, F } from '../../constants/polygrove';
import { loadCustom, useCustomCards } from '../../lib/custom';
import { follow, loadFollows, refreshFollowed, unfollow, useFollows } from '../../lib/follows';
import { Naturalist, Sighting, naturalist, sightingsOf } from '../../lib/inatPublic';
import { loadSol, useSol } from '../../lib/sol';
import { openWeb } from '../../lib/web';
import GreenBackdrop, { GREEN_BG } from '../../components/GreenBackdrop';

export default function Account() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useLocalSearchParams<{ login: string }>();
  const follows = useFollows();
  const balance = useSol();
  const [who, setWho] = useState<Naturalist | null>(null);
  const [list, setList] = useState<Sighting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);        // pages loaded so far
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const cards = useCustomCards();

  useEffect(() => {
    let live = true;
    Promise.all([loadFollows(), loadSol(), loadCustom()]);
    (async () => {
      try {
        const p = await naturalist(String(login));
        if (!live) return;
        if (!p) { setErr('That account could not be found.'); setBusy(false); return; }
        setWho(p); refreshFollowed(p);
        const r = await sightingsOf(p.id, 1);
        if (!live) return;
        setList(r.list); setTotal(r.total); setPage(1);
      } catch { if (live) setErr('iNaturalist can’t be reached right now.'); }
      finally { if (live) setBusy(false); }
    })();
    return () => { live = false; };
  }, [login]);

  const more = async () => {
    if (!who || busy || list.length >= total) return;
    setBusy(true);
    try { const r = await sightingsOf(who.id, page + 1); setList(l => [...l, ...r.list]); setPage(p => p + 1); }
    catch { /* keep what is shown */ }
    finally { setBusy(false); }
  };

  const following = !!who && follows.some(f => f.id === who.id);
  const yours = who ? cards.filter(c => c.by.id === who.id).length : 0;   // custom cards made from this person's sightings
  const close = () => (router.canGoBack() ? router.back() : router.replace('/social'));

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <GreenBackdrop />
      <CloseX onPress={close} />
      <FlatList
        data={list}
        keyExtractor={o => String(o.id)}
        renderItem={({ item }) => <SightingRow s={item} />}
        onEndReached={more} onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 30 }}
        ListHeaderComponent={
          <View style={s.head}>
            {who ? (
              <>
                {who.icon ? <Image source={{ uri: who.icon }} style={s.avatar} contentFit="cover" /> : <View style={[s.avatar, s.center]}><Text style={{ fontSize: 30 }}>🌿</Text></View>}
                <Text style={s.name} numberOfLines={1}>{who.name || who.login}</Text>
                <Pressable onPress={() => openWeb(`https://www.inaturalist.org/people/${who.login}`)} hitSlop={6}>
                  <Text style={s.login}>@{who.login} · iNaturalist ›</Text>
                </Pressable>
                <View style={s.stats}>
                  <Stat n={who.observations} label="Observations" />
                  {who.species != null && <Stat n={who.species} label="Species" />}
                  <Stat n={yours} label="Your cards" />
                </View>
                <Pressable onPress={() => (following ? unfollow(who.id) : follow(who))} style={[s.follow, following && s.following]}>
                  <Text style={[s.followTxt, following && { color: C.greenSoft }]}>{following ? '✓ Following' : 'Follow'}</Text>
                </Pressable>
                <Text style={s.sol}>{balance} Sol ☀️ · a custom card of a sighting costs 10</Text>
              </>
            ) : err ? <Text style={s.err}>{err}</Text> : <ActivityIndicator color={C.green} style={{ marginTop: 60 }} />}
          </View>
        }
        ListFooterComponent={busy && who ? <ActivityIndicator color={C.green} style={{ marginVertical: 18 }} /> : null}
        ListEmptyComponent={who && !busy ? <Text style={s.err}>No public observations yet.</Text> : null}
      />
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statN}>{n.toLocaleString()}</Text>
      <Text style={s.statL}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN_BG },
  center: { alignItems: 'center', justifyContent: 'center' },
  head: { alignItems: 'center', paddingTop: 34, paddingBottom: 18 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#1c2a1c', borderWidth: 2, borderColor: 'rgba(129,199,132,0.4)', marginBottom: 10 },
  name: { fontFamily: F.display, fontSize: 20, color: C.text },
  login: { fontFamily: F.sans, fontSize: 12, color: '#888', marginTop: 3 },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: 34, marginTop: 18, marginBottom: 16 },
  statN: { fontFamily: F.display, fontSize: 22, color: C.green, lineHeight: 28 },
  statL: { fontFamily: F.sansBold, fontSize: 9.5, color: '#666', textTransform: 'uppercase', marginTop: 2 },
  follow: { paddingVertical: 11, paddingHorizontal: 40, borderRadius: 22, backgroundColor: '#2E7D32', minWidth: 190, alignItems: 'center' },
  following: { backgroundColor: 'rgba(76,175,80,0.12)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)' },
  followTxt: { fontFamily: F.display, fontSize: 13.5, color: C.text },
  sol: { fontFamily: F.sans, fontSize: 11, color: '#777', marginTop: 12 },
  err: { fontFamily: F.sans, fontSize: 13, color: '#888', textAlign: 'center', paddingVertical: 40 },
});
