// PLAY THE ANIMAL'S SOUND (user, 2026-10-06): between the role line and the
// field note, for species with a licensed recording. A GREY PILL in the card's
// own pill style ("Tap for details"), with a time bar that fills as it plays;
// tap plays, tap again pauses. The SOURCE sits behind an ⓘ to the right of the
// bar (user, 2026-10-06: "instead of putting the rights right below it put an
// i button to the right of the bar and have it pop up to show the source").

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../constants/polygrove';
import { Sound } from '../lib/catalog';
import { openWeb } from '../lib/web';

const fmt = (sec: number) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// where the recording is hosted, from its url (the dataset name is not always filled in)
const hostOf = (url: string) =>
  /inaturalist/.test(url) ? 'iNaturalist' : /xeno-canto/.test(url) ? 'xeno-canto' : /naturalsciences\.be/.test(url) ? 'RBINS (Royal Belgian Institute of Natural Sciences)' : 'GBIF';
const LICENSE_URL: Record<string, string> = { 'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC-BY': 'https://creativecommons.org/licenses/by/4.0/' };

export default function SoundButton({ sound }: { sound: Sound }) {
  const player = useAudioPlayer({ uri: sound.url });
  const status = useAudioPlayerStatus(player);
  const [info, setInfo] = useState(false);
  const playing = status.playing && !status.didJustFinish;
  const dur = status.duration > 0 ? status.duration : 0;
  const at = status.didJustFinish ? dur : Math.min(status.currentTime, dur || Infinity);
  const frac = dur > 0 ? at / dur : 0;
  const toggle = () => {
    if (playing) { player.pause(); return; }
    if (status.didJustFinish || (dur > 0 && at >= dur - 0.05)) player.seekTo(0);
    player.play();
  };
  const host = sound.ds || hostOf(sound.url);
  return (
    <View style={s.row}>
      <Pressable onPress={toggle} hitSlop={6} style={s.pill}>
        <Text style={s.glyph}>{playing ? '❚❚' : '▶'}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${Math.round(frac * 100)}%` }]} /></View>
        <Text style={s.time}>{dur > 0 ? `${fmt(at)} / ${fmt(dur)}` : status.isLoaded ? '0:00' : '…'}</Text>
      </Pressable>
      <Pressable onPress={() => setInfo(true)} hitSlop={8} style={s.i} accessibilityRole="button" accessibilityLabel="Recording source">
        <Text style={s.iTxt}>i</Text>
      </Pressable>
      <Modal visible={info} transparent animationType="fade" onRequestClose={() => setInfo(false)}>
        <Pressable style={s.popWrap} onPress={() => setInfo(false)}>
          <View style={s.pop} onStartShouldSetResponder={() => true}>
            <Text style={s.popLabel}>RECORDING</Text>
            {sound.by ? <Text style={s.popBy}>recorded by {sound.by}</Text> : null}
            <Text style={s.popSrc}>{host}, via GBIF</Text>
            <Pressable onPress={() => openWeb(LICENSE_URL[sound.lic] ?? 'https://creativecommons.org/licenses/')} hitSlop={6}>
              <Text style={s.popLink}>{sound.lic === 'CC0' ? 'CC0 — public domain dedication' : `${sound.lic} 4.0 licence`} ›</Text>
            </Pressable>
            <Pressable onPress={() => openWeb(sound.url)} hitSlop={6}>
              <Text style={s.popLink}>The recording ›</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#222222', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  glyph: { color: '#999999', fontSize: 11, lineHeight: 14, width: 16 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#333333', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#999999' },
  time: { color: '#999999', fontSize: 11, fontFamily: F.sans, fontVariant: ['tabular-nums'] },
  // the ⓘ, in the card's small round-button style
  i: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  iTxt: { color: '#6e6e6e', fontSize: 11, lineHeight: 13, fontStyle: 'italic', fontFamily: F.sansBold },
  popWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  pop: { backgroundColor: '#222222', borderRadius: 14, borderWidth: 1, borderColor: '#3a3a3a', padding: 16, width: '100%', maxWidth: 320, gap: 6 },
  popLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#888888', marginBottom: 2 },
  popBy: { fontFamily: F.sansBold, fontSize: 13, color: C.text },
  popSrc: { fontFamily: F.sans, fontSize: 12, color: '#999999' },
  popLink: { fontFamily: F.sansMed, fontSize: 12, color: C.greenSoft, marginTop: 4 },
});
