// THE MAP PAGE'S FRAME, IN A BROWSER (user, 2026-10-08: "can we put this app
// up as a website"). react-native-webview has no browser version — the map
// was a blank screen — so here the map page sits in an iframe and the two
// talk by postMessage:
//   page → app   {polygrove: '<the JSON the phone gets from onMessage>'}
//   app → page   {pgCall: 'polygroveSetState', args: [...]}
// The app's injectJavaScript() strings are all of one shape —
//   window.polygroveX && window.polygroveX(<JSON arguments>); true;
// — so that shape is parsed into a call the page will accept (map.html only
// runs functions named polygrove…; it never evaluates code from a message).

import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  source: { uri: string };
  style?: StyleProp<ViewStyle>;
  onMessage?: (e: { nativeEvent: { data: string } }) => void;
  onError?: () => void;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
};
export type WebFrameRef = { injectJavaScript: (code: string) => void };
export type FrameMessage = { nativeEvent: { data: string } };

const CALL = /^\s*window\.(polygrove\w+)\s*&&\s*window\.\1\(([\s\S]*)\);\s*true;\s*$/;

export const WebFrame = forwardRef<WebFrameRef, Props>(function WebFrame({ source, style, onMessage, onError, pointerEvents }, ref) {
  const el = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  useEffect(() => { handler.current = onMessage; });
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== el.current?.contentWindow) return;   // only this frame's own page
      const d = ev.data as { polygrove?: unknown } | null;
      if (d && typeof d.polygrove === 'string') handler.current?.({ nativeEvent: { data: d.polygrove } });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  useImperativeHandle(ref, () => ({
    injectJavaScript(code: string) {
      const m = CALL.exec(code);
      if (!m) return;
      let args: unknown[];
      try { args = JSON.parse(`[${m[2]}]`); } catch { return; }
      el.current?.contentWindow?.postMessage({ pgCall: m[1], args }, '*');
    },
  }), []);
  // pointer-events is left to INHERIT unless 'none' is asked for: the hidden map overlay turns
  // touches off on its root, and an iframe that said 'auto' kept swallowing every click on Camp
  const flat = (StyleSheet.flatten(style) ?? {}) as CSSProperties;
  return (
    <iframe ref={el} src={source.uri} title="Polygrove map" onError={onError}
      style={{ border: 0, display: 'block', width: '100%', height: '100%', ...flat, ...(pointerEvents === 'none' ? { pointerEvents: 'none' as const } : null) }} />
  );
});
