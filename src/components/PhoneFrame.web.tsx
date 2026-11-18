// ON A COMPUTER THE GAME IS SHOWN AT PHONE SIZE, ON BLACK (user, 2026-11-18: "can you make
// the website version of the phone app the size of a phone with black borders").
// The game is built for a phone; stretched across a wide window its cards float in empty
// space and the map buttons sit far apart. So a wide browser window shows this instead: a
// black page with the game running inside a phone-sized frame in the middle.
// The frame is a real inner page (an iframe of this same address), so everything inside
// measures the PHONE's width and height, not the window's — nothing else in the app has to
// know. It is the same site, so the journal and settings saved in the browser are shared.
// A phone, or any narrow window, never sees this: the root layout only uses it when the
// window is wide and the page is not already inside a frame.

import { createElement } from 'react';

export const FRAME_MIN_W = 700;       // narrower than this, the game fills the window as before
const PHONE_W = 402, PHONE_H = 874;   // a current large phone, in points

export function wantsFrame(): boolean {
  if (typeof window === 'undefined') return false;
  try { if (window.self !== window.top) return false; } catch { return false; }   // already inside a frame
  return window.innerWidth >= FRAME_MIN_W;
}

export default function PhoneFrame() {
  return createElement('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
  }, createElement('iframe', {
    src: window.location.href,
    title: 'Polygrove',
    allow: 'fullscreen; clipboard-write',
    style: {
      width: PHONE_W, maxWidth: '100vw',
      height: `min(${PHONE_H}px, calc(100vh - 32px))`,
      border: '1px solid #262626', borderRadius: 28, background: '#0A0F09', display: 'block',
    },
  }));
}
