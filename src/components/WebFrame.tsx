// THE MAP PAGE'S FRAME. On a phone this is react-native-webview's WebView,
// unchanged. In a browser (the app as a website, 2026-10-08) it is an iframe
// with the same handful of props — see WebFrame.web.tsx. Everything that
// embeds the map page imports from here.
import { WebView } from 'react-native-webview';

export const WebFrame = WebView;
export type WebFrameRef = WebView;
/** what onMessage hands over, on either platform */
export type FrameMessage = { nativeEvent: { data: string } };
