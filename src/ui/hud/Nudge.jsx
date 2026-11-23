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
const QUIET_LINE = 'Nothing needs you just now.';
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
  const L = 58, gap = 8, p = r.panel, out = 10;
  // the arrow points at the target; the caption sits beyond the edge of the panel the target is in,
  // so it never lies over panel text
  if (side === 'above') return { side, x: cx, y: r.top - gap, rot: 90, cap: { left: cx, top: Math.min(r.top - gap - L - 6, p ? p.top - out : Infinity), anchor: 'bottom' } };
  if (side === 'below') return { side, x: cx, y: r.top + r.height + gap, rot: -90, cap: { left: cx, top: Math.max(r.top + r.height + gap + L + 6, p ? p.bottom + out : -Infinity), anchor: 'top' } };
  if (side === 'right') return { side, x: r.left + r.width + gap, y: cy, rot: 180, cap: { left: Math.max(r.left + r.width + gap + L + 8, p ? p.right + out : -Infinity), top: cy, anchor: 'left' } };
  return { side, x: r.left - gap, y: cy, rot: 0, cap: { left: Math.min(r.left - gap - L - 8, p ? p.left - out : Infinity), top: cy, anchor: 'right' } };
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
            <motion.path d="M2 26 C 18 30, 34 14, 58 20" fill="none" stroke={`var(--color-${tone})`} strokeWidth="4" strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3, ease: 'easeOut' }} />
            <motion.path d="M48 12 L59 20 L47 27" fill="none" stroke={`var(--color-${tone})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
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

  // a new run forgets what was already suggested
  useEffect(() => onEvent((e) => { if (e.type === 'reset') st.current.mem = {}; }), []);
  useEffect(() => onHud((e) => {
    if (e.type === 'nudges') setOn(e.on);
    if (e.type === 'ask') {
      // asking skips the idle wait and the gap, and works even with idle hints off
      const t = now(), s = st.current;
      // the rotation first; if everything is cooling down, the one shown longest ago (never the same twice running)
      let sug = nextSuggestion(game.G, s.mem, t);
      if (!sug) {
        const list = suggestions(game.G).filter((x, _, all) => all.length < 2 || x.id !== s.cur?.s.id);
        sug = list.sort((a, b) => (s.mem[a.id] ?? -1e9) - (s.mem[b.id] ?? -1e9))[0] || null;
      }
      if (sug) { if (s.mem) s.mem[sug.id] = t; setCur({ s: sug, shownAt: t, done: false, asked: true }); }
      else setCur({ s: { id: 'none', target: '', weight: 0, text: QUIET_LINE, plain: '' }, shownAt: t, done: false, asked: true, quietLine: true });
    }
  }), []);

  // any input resets the idle clock and softly dismisses the current nudge
  useEffect(() => {
    const poke = (e) => {
      // the ask button (and its keys) asks for a hint: that is not "doing something else"
      if (e?.target?.closest?.('[data-tut="ask"]')) return;
      if (e?.type === 'keydown' && (e.key === '?' || e.key === 'h' || e.key === 'H' || e.key === 'Shift')) { if (e.key !== 'Shift') return; }
      st.current.idleSince = now();
      const c = st.current.cur;
      if (c && !c.done && !c.quietLine) {
        // did the player just do the suggested thing? (checked after the action has applied)
        setTimeout(() => {
          if (st.current.cur !== c) return;
          const still = suggestions(game.G).some((x) => x.id === c.s.id);
          if (!still) { setCur({ ...c, done: true }); setTimeout(() => setCur((x) => (x && x.s.id === c.s.id ? null : x)), 600); } else setCur(null);
        }, 120);
      }
    };
    // a resting hand jitters: only travel of more than ~40 px within a second counts as input
    let trail = [];
    const onMove = (e) => {
      const t = now();
      trail.push([t, e.clientX, e.clientY]);
      trail = trail.filter((p) => t - p[0] < 1);
      const [, x0, y0] = trail[0];
      if (Math.hypot(e.clientX - x0, e.clientY - y0) > 40) { trail = []; poke(e); }
    };
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
      const step = activeStep(game.G, loadTut());
      if (step?.id !== s.tutId) { s.tutId = step?.id; s.tutAt = t; }
      const tutorialBusy = step && t - s.tutAt < 40;
      const modal = [...document.querySelectorAll('[aria-modal="true"]')].some((m) => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(m).visibility !== 'hidden'; });
      if (s.cur?.asked) { if (t - s.cur.shownAt > (s.cur.quietLine ? 4 : life)) { setCur(null); s.nextAt = t + gap; } return; }
      const quiet = !on || blocked || !game.started || modal || tutorialBusy;
      if (quiet) { if (s.cur) setCur(null); s.idleSince = Math.max(s.idleSince, t - idle + 2); return; }
      if (s.cur) {
        if (!s.cur.done && t - s.cur.shownAt > life) { setCur(null); s.nextAt = t + gap; }
        return;
      }
      if (t - s.idleSince < idle || t < s.nextAt) return;
      const sug = nextSuggestion(game.G, s.mem, t);
      if (sug) setCur({ s: sug, shownAt: t, done: false });
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

  // tell the guide when a hint has the floor
  const showing = !!cur;
  useEffect(() => { emitHud({ type: 'nudge', on: showing }); return () => { if (showing) emitHud({ type: 'nudge', on: false }); }; }, [showing]);

  const L = rect && layout(rect);
  const urgent = cur && cur.s.weight >= 90;
  const tone = urgent ? 'magenta' : 'ink';
  // no target on screen: a centred caption under the top bar, no arrow
  const capStyle = L ? {
    left: Math.max(130, Math.min(window.innerWidth - 130, L.cap.left)), top: L.cap.top,
    transform: { bottom: 'translate(-50%, -100%)', top: 'translate(-50%, 0)', left: 'translate(0, -50%)', right: 'translate(-100%, -50%)' }[L.cap.anchor],
  } : { left: '50%', top: '24%', transform: 'translate(-50%, 0)' };
  const bob = L && { above: { y: [0, -5, 0] }, below: { y: [0, 5, 0] }, right: { x: [0, 5, 0] }, left: { x: [0, -5, 0] } }[L.side];

  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-live="polite">
      <AnimatePresence>
        {cur && (
          <motion.div key={cur.s.id + cur.shownAt} className="absolute inset-0"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }} transition={{ duration: 0.3 }}>
            {/* the arrow: its tip sits at (x, y), pointing into the target */}
            {L && <motion.div className="absolute" style={{ left: L.x, top: L.y }} animate={cur.done ? {} : bob} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
              <div style={{ position: 'absolute', left: -60, top: -20, width: 64, height: 40, transformOrigin: '60px 20px', transform: `rotate(${L.rot}deg)` }}>
                <Arrow tone={tone} done={cur.done} />
              </div>
            </motion.div>}
            {!cur.done && (
              <motion.div className="absolute w-max max-w-[260px] rounded-[12px] border-[3px] border-ink bg-paper px-3 py-2 shadow-[3px_4px_0_0_color-mix(in_srgb,var(--color-ink)_100%,transparent)]" style={capStyle}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.25 }}>
                <p className={urgent ? 'font-body text-[15px] italic leading-snug text-magenta' : 'font-body text-[15px] italic leading-snug text-ink-2'}>{cur.s.text}</p>
                {cur.s.plain && <p className="mt-0.5 font-body text-[13px] leading-snug text-ink">{cur.s.plain}</p>}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
