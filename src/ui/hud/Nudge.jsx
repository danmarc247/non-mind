// Idle nudges: when the player has been still for a while, one quiet suggestion at a time
// (src/game/advisor.js decides what; this decides where and how softly). A hand-drawn arrow that
// draws itself and bobs, a nearly transparent caption, pointer-events none, never over the target.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IDLE_BEFORE_SUGGESTING, SUGGESTION_LIFETIME, SUGGESTION_GAP, nextSuggestion, suggestions } from '../../game/index.js';
import { game, onEvent } from '../../game/store.js';
import { emitHud, onHud } from './bus.js';
import { anchorRect } from './Tutorial.jsx';
import { activeStep, loadTut } from './tutorial.js';

export const NUDGE_KEY = 'non-mind-nudges';
export const nudgesOn = () => { try { return localStorage.getItem(NUDGE_KEY) !== '0'; } catch { return true; } };
export const setNudges = (on) => { try { localStorage.setItem(NUDGE_KEY, on ? '1' : '0'); } catch { /* not persisted */ } emitHud({ type: 'nudges', on }); };

const T = () => {
  const d = (typeof window !== 'undefined' && window.__nudgeDebug) || {};
  return { idle: d.idle ?? IDLE_BEFORE_SUGGESTING, life: d.life ?? SUGGESTION_LIFETIME, gap: d.gap ?? SUGGESTION_GAP };
};
const now = () => performance.now() / 1000;

// game events that only a player's action produces
const ACTS = new Set(['attend', 'unitNew', 'integrate', 'subtract', 'split', 'repurpose', 'verbStart', 'spell', 'stance', 'mirror']);
const ACT_SFX = new Set(['buy', 'reroll', 'place', 'upgrade', 'error']);

const tabOf = (kind) => ({ habit: 'habits', upgrade: 'upgrades', spell: 'insight', verb: 'verbs', stance: 'stance', mirror: 'mirror', attendant: 'attendants' }[kind]);

/** Anchor candidates for an advisor target, most specific first. */
function anchorsFor(target) {
  const [kind, a, b] = target.split(':');
  switch (kind) {
    case 'attend': return ['attend', 'core'];
    case 'shop': return [`shop-${a}`, 'shop', 'pill-shop'];
    case 'reroll': return ['reroll', 'pill-shop'];
    case 'xp': return ['xp', 'pill-shop'];
    case 'unit': return [`unit-${a}`, 'pill-bench', 'core'];
    case 'op': return Number(game.selected) === Number(b) ? [`op-${a}`, 'pill-regard'] : [`unit-${b}`, 'pill-bench', 'core'];
    case 'verb': return Number(game.selected) === Number(b) ? [`verbbtn-${a}`, `verb-${a}`, 'tab-verbs'] : [`verb-${a}`, 'tab-verbs'];
    case 'habit': case 'upgrade': case 'spell': return [`${kind}-${a}`, `tab-${tabOf(kind)}`];
    case 'stance': case 'mirror': case 'attendant': return [kind, `tab-${tabOf(kind)}`];
    case 'reset': case 'lineage': case 'codex': return [kind];
    default: return [];
  }
}
function resolve(target) {
  for (const id of anchorsFor(target)) { const r = anchorRect(id); if (r) return r; }
  return null;
}

// arrow sits outside the target on the roomiest side and points at it
function layout(r) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const side = cy > vh * 0.62 ? 'above' : cy < vh * 0.25 ? 'below' : cx < vw * 0.5 ? 'right' : 'left';
  const L = 58, gap = 8;
  if (side === 'above') return { side, x: cx, y: r.top - gap, rot: 90, cap: { left: cx, top: r.top - gap - L - 6, anchor: 'bottom' } };
  if (side === 'below') return { side, x: cx, y: r.top + r.height + gap, rot: -90, cap: { left: cx, top: r.top + r.height + gap + L + 6, anchor: 'top' } };
  if (side === 'right') return { side, x: r.left + r.width + gap, y: cy, rot: 180, cap: { left: r.left + r.width + gap + L + 8, top: cy, anchor: 'left' } };
  return { side, x: r.left - gap, y: cy, rot: 0, cap: { left: r.left - gap - L - 8, top: cy, anchor: 'right' } };
}

// arrow drawn pointing right (+x), tip at (60, 20): rotate around the tip
function Arrow({ tone, done }) {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" style={{ overflow: 'visible' }} aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.path key="tick" d="M34 20 L44 30 L62 6" fill="none" stroke={`var(--color-${tone})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} />
        ) : (
          <motion.g key="arrow">
            <motion.path d="M2 26 C 18 30, 34 14, 58 20" fill="none" stroke={`var(--color-${tone})`} strokeWidth="3.5" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3, ease: 'easeOut' }} />
            <motion.path d="M48 12 L59 20 L47 27" fill="none" stroke={`var(--color-${tone})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26, duration: 0.08 }} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

export default function Nudge({ blocked }) {
  const [on, setOn] = useState(nudgesOn);
  const [cur, setCur] = useState(null); // { s, shownAt, done }
  const [rect, setRect] = useState(null);
  const st = useRef({ idleSince: now(), nextAt: 0, mem: {}, cur: null });
  st.current.cur = cur;

  useEffect(() => onHud((e) => { if (e.type === 'nudges') setOn(e.on); }), []);

  // any input resets the idle clock and softly dismisses the current nudge
  useEffect(() => {
    const poke = () => {
      st.current.idleSince = now();
      const c = st.current.cur;
      if (c && !c.done) {
        // did the player just do the suggested thing? (checked after the action has applied)
        setTimeout(() => {
          const still = suggestions(game.G).some((x) => x.id === c.s.id);
          if (!still) { setCur({ ...c, done: true }); setTimeout(() => setCur(null), 600); } else setCur(null);
        }, 120);
      }
    };
    const onMove = (e) => { if (e.target && e.target.tagName !== 'CANVAS') poke(); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((n) => window.addEventListener(n, poke, { passive: true, capture: true }));
    window.addEventListener('pointermove', onMove, { passive: true, capture: true });
    const off = onEvent((e) => { if (ACTS.has(e.type) || (e.type === 'sfx' && ACT_SFX.has(e.name))) poke(); });
    return () => { evs.forEach((n) => window.removeEventListener(n, poke, { capture: true })); window.removeEventListener('pointermove', onMove, { capture: true }); off(); };
  }, []);

  // the clock
  useEffect(() => {
    const iv = setInterval(() => {
      const s = st.current, t = now(), { idle, life, gap } = T();
      const quiet = !on || blocked || !game.started || document.querySelector('[aria-modal="true"]') || activeStep(game.G, loadTut());
      if (quiet) { if (s.cur) setCur(null); s.idleSince = Math.max(s.idleSince, t - idle + 2); return; }
      if (s.cur) {
        if (!s.cur.done && t - s.cur.shownAt > life) { setCur(null); s.nextAt = t + gap; }
        return;
      }
      if (t - s.idleSince < idle || t < s.nextAt) return;
      const sug = nextSuggestion(game.G, s.mem, t);
      if (sug && resolve(sug.target)) setCur({ s: sug, shownAt: t, done: false });
      else s.nextAt = t + gap;
    }, 250);
    return () => clearInterval(iv);
  }, [on, blocked]);

  // follow the target while shown
  useEffect(() => {
    if (!cur) { setRect(null); return undefined; }
    const upd = () => setRect((o) => { const r = resolve(cur.s.target); return o && r && Math.abs(o.left - r.left) < 1 && Math.abs(o.top - r.top) < 1 ? o : r; });
    upd();
    const iv = setInterval(upd, 200);
    return () => clearInterval(iv);
  }, [cur?.s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const L = rect && layout(rect);
  const urgent = cur && cur.s.weight >= 90;
  const tone = urgent ? 'magenta' : 'ink';
  const capStyle = L && {
    left: L.cap.left, top: L.cap.top,
    transform: { bottom: 'translate(-50%, -100%)', top: 'translate(-50%, 0)', left: 'translate(0, -50%)', right: 'translate(-100%, -50%)' }[L.cap.anchor],
  };
  const bob = L && { above: { y: [0, -5, 0] }, below: { y: [0, 5, 0] }, right: { x: [0, 5, 0] }, left: { x: [0, -5, 0] } }[L.side];

  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-live="polite">
      <AnimatePresence>
        {cur && L && (
          <motion.div key={cur.s.id + cur.shownAt} className="absolute inset-0"
            initial={{ opacity: 0 }} animate={{ opacity: urgent ? 0.95 : 0.78 }} exit={{ opacity: 0, transition: { duration: 0.35 } }} transition={{ duration: 0.3 }}>
            {/* the arrow: its tip sits at (x, y), pointing into the target */}
            <motion.div className="absolute" style={{ left: L.x, top: L.y }} animate={cur.done ? {} : bob} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
              <div style={{ position: 'absolute', left: -60, top: -20, width: 64, height: 40, transformOrigin: '60px 20px', transform: `rotate(${L.rot}deg)` }}>
                <Arrow tone={tone} done={cur.done} />
              </div>
            </motion.div>
            {!cur.done && (
              <motion.div className="absolute max-w-[240px] rounded-[10px] border border-ink/20 bg-paper/60 px-2.5 py-1.5" style={capStyle}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.25 }}>
                <p className={urgent ? 'font-body text-[13px] italic leading-snug text-magenta' : 'font-body text-[13px] italic leading-snug text-ink-2'}>{cur.s.text}</p>
                <p className="mt-0.5 font-body text-[12px] leading-snug text-ink">{cur.s.plain}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
