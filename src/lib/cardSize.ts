// THE CARD'S SIZE — one size, everywhere (user, 2026-11-17: "make the size of cards
// uniformly the size of when you open up packs. that is the definitive size").
// It is the pack's card: at most 340 wide, and as tall as the screen allows with room
// under it for one button. Until then every screen sized its own — the journal's was 61%
// of the window's height, the quiz's 56%, the species page's 72%, the pack's the tallest.

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CARD_MAX_W = 340;
// what is left of the screen's height for things around the card: 16 above it, and the
// row under it (a pack's swipe footer, or the daily card's quiz button and link)
const CARD_CHROME = 134;

export function useCardSize(): { width: number; height: number } {
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return {
    width: Math.min(win.width - 40, CARD_MAX_W),
    height: Math.max(360, win.height - insets.top - insets.bottom - CARD_CHROME),
  };
}
