// PLAY THE ANIMAL'S SOUND (user, 2026-10-06): a small button on the card, between
// the role line and the field note, for species with a licensed recording.
// Tap plays, tap again pauses; the recordist's credit sits beside it. The
// player is created only when there is a sound to play.

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { F } from '../constants/polygrove';
import { Sound } from '../lib/catalog';

export default function SoundButton({ sound, color }: { sound: Sound; color: string }) {
  const player = useAudioPlayer({ uri: sound.url });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing && !status.didJustFinish;
  const toggle = () => {
    if (playing) { player.pause(); return; }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05)) player.seekTo(0);
    player.play();
  };
  return (
    <View style={s.row}>
      <Pressable onPress={toggle} hitSlop={8} style={[s.btn, { borderColor: `${color}88`, backgroundColor: `${color}1f` }]}>
        <Text style={[s.glyph, { color }]}>{playing ? '❚❚' : '▶'}</Text>
        <Text style={[s.label, { color }]}>{playing ? 'Playing' : 'Hear it'}</Text>
      </Pressable>
      <Text style={s.credit} numberOfLines={1}>{sound.by ? `recorded by ${sound.by} · ` : ''}{sound.lic} · iNaturalist</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  glyph: { fontSize: 11, lineHeight: 14 },
  label: { fontFamily: F.sansBold, fontSize: 11.5 },
  credit: { flex: 1, fontFamily: F.sans, fontSize: 9.5, color: '#666666' },
});
