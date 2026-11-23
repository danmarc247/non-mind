// Plain words for a card's boon (src/game/content/cards.js `boon`), matching cardBoon in game.js/battle.js:
// affect/insight/capacity/residue scale the whole run, tolerance/salience every unit's stat,
// attention is a flat bonus paid with each won wave. Strings go through t() so the locale can swap them.
import { t } from '../../i18n/index.js';

const LINES = {
  affect: '+%v% affect, always',
  insight: '+%v% insight, always',
  capacity: '+%v% capacity, always',
  residue: '+%v% residue per reset',
  tolerance: '+%v% tolerance, every unit',
  salience: '+%v% salience, every unit',
  attention: '+%v attention per wave won',
};
export function boonText(boon) {
  if (!boon) return '';
  const v = boon.pct ?? boon.flat ?? 0;
  return t(LINES[boon.kind] || `+%v ${boon.kind}`).replace('%v', v);
}

// Which collected cards the player has already looked at, so new ones can glow until viewed.
// Per-browser convenience only: losing it only means a card glows once more.
const KEY = 'non-mind-book-seen';
export function readSeen() {
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch { return new Set(); }
}
export function writeSeen(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* storage blocked */ }
}
