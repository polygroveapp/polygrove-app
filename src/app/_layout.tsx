import { DelaGothicOne_400Regular } from '@expo-google-fonts/dela-gothic-one';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapOverlay from '../components/MapOverlay';
import Splash from '../components/Splash';
import { C } from '../constants/polygrove';
import { launchReset } from '../lib/launch';
import { offlineReady } from '../lib/offline';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DelaGothicOne_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  // hydrate the pack queue + journal snapshots before any screen needs them
  useEffect(() => { offlineReady(); launchReset(); }, []);
  // the demo's intro plays over the app on every cold launch, and the app
  // LAUNCHES STRAIGHT TO THE MAP (user, 2026-09-29) — it opens underneath the
  // intro, so the map is already drawn when the intro lifts
  const router = useRouter();
  const pathname = usePathname();
  const [splash, setSplash] = useState(true);
  const afterSplash = useCallback(() => setSplash(false), []);
  useEffect(() => {
    if (!fontsLoaded) return;
    const t = setTimeout(() => router.replace({ pathname: '/map', params: { tab: '1' } }), 0);   // once the navigator is mounted
    return () => clearTimeout(t);
  }, [fontsLoaded, router]);
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={({ route }) => ({
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          // tab changes (BottomNav's `tab` param) switch instantly; everything
          // else slides in from the right
          animation: (route.params as { tab?: string } | undefined)?.tab ? 'none' : 'slide_from_right',
        })}
      />
      {/* the map lives here, always loaded, shown on the Map tab */}
      <MapOverlay visible={pathname === '/map'} />
      {splash && <Splash onDone={afterSplash} />}
    </GestureHandlerRootView>
  );
}
