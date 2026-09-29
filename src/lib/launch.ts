// EVERY LAUNCH STARTS FRESH while the app is being built (user, 2026-09-29:
// "when you launch the app make it so you can open a daily pack and also you
// start out with 1000 sol"): the Discovery Pack is ready and Sol is back at
// 1000. The journal, mastery and camp are untouched.
// DEVELOPMENT BUILDS ONLY (__DEV__, which includes Expo Go) — a shipped build
// keeps the real 24-hour pack and the Sol a player has earned. Flip
// LAUNCH_RESET to `true` to make it apply everywhere.

import { loadDaily, resetDiscovery } from './daily';
import { loadSol, resetSol } from './sol';

export const LAUNCH_RESET = __DEV__;

let done = false;
export async function launchReset() {
  if (!LAUNCH_RESET || done) return;
  done = true;
  await Promise.all([loadDaily(), loadSol()]);   // after the stored values load, so they can't overwrite the reset
  resetDiscovery();
  resetSol();
}
