// The phone-sized frame is for web browsers only (see PhoneFrame.web.tsx).
// On a phone the app already is the size of a phone.

export const FRAME_MIN_W = 700;
export function wantsFrame(): boolean { return false; }
export default function PhoneFrame() { return null; }
