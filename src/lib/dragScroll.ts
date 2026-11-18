// CLICK AND DRAG TO SLIDE A ROW, ON A COMPUTER (user, 2026-11-18: "can you make this a
// click swipe to move across to different cards"). A sideways row slides under a finger on
// a phone, but a mouse has no swipe: with no trackpad the only way along the Journal's card
// row was to pick hexagons one at a time. This lets a mouse hold the row and pull it.
//   - web only, mouse only (touch and trackpads already scroll the row themselves)
//   - nothing happens until the mouse has moved a little, so a plain click still flips a card
//   - `step` (the distance from one card to the next) makes it a card row: letting go glides
//     to the nearest card, and a short pull still moves one whole card in that direction
//   - a drag never counts as a click on whatever was under the mouse
// The pointer is "captured" while dragging, so letting go outside the row — or outside the
// phone-sized frame a desktop browser shows the game in — still ends the drag.

import { RefObject, useEffect } from 'react';
import { Platform } from 'react-native';

type Scrollable = { getScrollableNode?: () => unknown } | null;
const START_PX = 6;      // movement before a press becomes a drag
const NUDGE_PX = 45;     // a pull this long always moves at least one card

export function useMouseDragScroll(ref: RefObject<Scrollable>, opts: { step?: number; count?: number; ready?: boolean } = {}) {
  const { step, count, ready = true } = opts;
  useEffect(() => {
    if (Platform.OS !== 'web' || !ready) return;
    const node = ref.current?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node || !node.addEventListener) return;
    let down = false, dragging = false, x0 = 0, s0 = 0, id = -1;
    let resnap: ReturnType<typeof setTimeout> | null = null;
    const snapWas = node.style.scrollSnapType;
    node.style.cursor = 'grab';
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragging = false; x0 = e.clientX; s0 = node.scrollLeft; id = e.pointerId;
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== id) return;
      const dx = e.clientX - x0;
      if (!dragging) {
        if (Math.abs(dx) < START_PX) return;
        dragging = true;
        if (resnap) { clearTimeout(resnap); resnap = null; }
        node.style.scrollSnapType = 'none';   // the browser's snapping would fight every move
        node.style.cursor = 'grabbing';
        node.style.userSelect = 'none';
        try { node.setPointerCapture(id); } catch { /* the pointer is already gone */ }
      }
      node.scrollLeft = s0 - dx;
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== id) return;
      down = false;
      if (!dragging) return;
      node.style.cursor = 'grab';
      node.style.userSelect = '';
      try { node.releasePointerCapture(id); } catch { /* not held */ }
      if (step && step > 0) {
        const dx = e.clientX - x0, from = Math.round(s0 / step);
        let i = Math.round(node.scrollLeft / step);
        if (i === from && Math.abs(dx) >= NUDGE_PX) i = from + (dx < 0 ? 1 : -1);
        i = Math.max(0, Math.min((count ?? Infinity) - 1, i));
        // `scroll`, not `scrollTo`: React Native's web ScrollView replaces this element's
        // scrollTo with its own, which reads {x, y, animated} — given {left} it glides to 0
        node.scroll({ left: i * step, behavior: 'smooth' });
        resnap = setTimeout(() => { node.style.scrollSnapType = snapWas; resnap = null; }, 450);   // once the glide is over
      } else node.style.scrollSnapType = snapWas;
      // the click that follows a drag is not a click
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      node.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => node.removeEventListener('click', swallow, true), 0);
    };
    const noDrag = (e: Event) => e.preventDefault();   // no ghost image of a photo following the mouse
    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
    node.addEventListener('pointercancel', onUp);
    node.addEventListener('dragstart', noDrag);
    return () => {
      if (resnap) clearTimeout(resnap);
      node.style.cursor = ''; node.style.userSelect = ''; node.style.scrollSnapType = snapWas;
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onUp);
      node.removeEventListener('dragstart', noDrag);
    };
  }, [ref, step, count, ready]);
}
