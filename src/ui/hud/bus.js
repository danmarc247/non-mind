// Tiny in-HUD event bus (keyboard -> buttons, so hotkeys get the same pop as clicks).
import { act, game } from '../../game/store.js';

const subs = new Set();
export const onHud = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const emitHud = (e) => subs.forEach((fn) => fn(e));

/** Attend through the HUD: acts, then tells the button to pop and float the gain. */
export function attend() {
  if (!game.started) return 0;
  const amt = act('attend');
  emitHud({ type: 'attend', amt });
  return amt;
}

/** Press flash for a hotkey-bound control. */
export const pressed = (id) => emitHud({ type: 'press', id });
