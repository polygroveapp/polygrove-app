import { DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Splash from '../components/Splash';
import { C } from '../constants/polygrove';
import { loadCurrentEco } from '../lib/ecoregions';
import { offlineReady } from '../lib/offline';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DelaGothicOne_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  // hydrate the pack queue + journal snapshots before any screen needs them
  useEffect(() => { offlineReady(); }, []);
  // the demo's intro plays over the app on every cold launch; when it lifts,
  // a player with no camp yet lands on the map to pick one (user, 2026-09-29)
  const router = useRouter();
  const [splash, setSplash] = useState(true);
  const afterSplash = useCallback(() => {
    setSplash(false);
    loadCurrentEco().then(eco => { if (!eco) router.push('/map'); });
  }, [router]);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'slide_from_right',
        }}
      />
      {splash && <Splash onDone={afterSplash} />}
    </GestureHandlerRootView>
  );
}
