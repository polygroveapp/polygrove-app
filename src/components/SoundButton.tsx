// PLAY THE ANIMAL'S SOUND (user, 2026-10-06): between the role line and the
// field note, for species with a licensed recording. A GREY PILL in the card's
// own pill style ("Tap for details"), with a time bar that fills as it plays;
// tap plays, tap again pauses. The recordist's credit sits beneath.

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F } from '../constants/polygrove';
import { Sound } from '../lib/catalog';

const fmt = (sec: number) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function SoundButton({ sound }: { sound: Sound }) {
  const player = useAudioPlayer({ uri: sound.url });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing && !status.didJustFinish;
  const dur = status.duration > 0 ? status.duration : 0;
  const at = status.didJustFinish ? dur : Math.min(status.currentTime, dur || Infinity);
  const frac = dur > 0 ? at / dur : 0;
  const toggle = () => {
    if (playing) { player.pause(); return; }
    if (status.didJustFinish || (dur > 0 && at >= dur - 0.05)) player.seekTo(0);
    player.play();
  };
  return (
    <View style={s.wrap}>
      <Pressable onPress={toggle} hitSlop={6} style={s.pill}>
        <Text style={s.glyph}>{playing ? '❚❚' : '▶'}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${Math.round(frac * 100)}%` }]} /></View>
        <Text style={s.time}>{dur > 0 ? `${fmt(at)} / ${fmt(dur)}` : status.isLoaded ? '0:00' : '…'}</Text>
      </Pressable>
      <Text style={s.credit} numberOfLines={1}>{sound.by ? `recorded by ${sound.by} · ` : ''}{sound.lic} · iNaturalist</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 10, gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#222222', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  glyph: { color: '#999999', fontSize: 11, lineHeight: 14, width: 16 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#333333', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#999999' },
  time: { color: '#999999', fontSize: 11, fontFamily: F.sans, fontVariant: ['tabular-nums'] },
  credit: { fontFamily: F.sans, fontSize: 9.5, color: '#666666', paddingHorizontal: 2 },
});
