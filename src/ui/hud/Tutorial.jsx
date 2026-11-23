// Tutorial overlay: a soft spotlight on the target, an anchored callout, and a hand-drawn pointer line.
// Advances on the player's real actions (engine events / state), with "got it" only where nothing must be pressed.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InkButton } from '../bits';
import { game, onEvent, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { emitHud, onHud } from './bus.js';
import { CORE, SHEET_OF, activeStep, loadTut, saveTut } from './tutorial.js';
import { POP } from './shared.jsx';
import { mood } from '../../gfx/mood.js';

const cardW = () => Math.min(310, window.innerWidth - 28);
const PAD = 10;

/** Where is the anchor on screen? 'core' is the centre of the arena (the 3D scene keeps it centred). */
function anchorRect(anchor) {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (anchor === 'core') {
    // gfx may publish the projected core (mood.coreScreen = {x, y, r} in css px); otherwise use the
    // home camera: eye (0,21,29) on target (0,-3.2,0), fov 44, core at y 1.7 -> 36.6% of the height
    const c = mood.coreScreen;
    const x = c?.x ?? vw / 2, y = c?.y ?? vh * 0.366, r = c?.r ?? vh * 0.075;
    return { left: x - r, top: y - r, width: 2 * r, height: 2 * r, round: true };
  }
  if (!anchor) return null;
  const el = document.querySelector(`[data-tut="${anchor}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
const same = (a, b) => (!a && !b) || (a && b && Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

function placeCard(t, ch, prefer, gap = 56) {
  const vw = window.innerWidth, vh = window.innerHeight, M = 14, GAP = gap;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (!t) return { left: (vw - cardW()) / 2, top: vh * 0.24 };
  const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
  const opts = prefer ? [prefer] : [];
  if (cy > vh * 0.55) opts.push('above'); else opts.push('below');
  if (cx < vw * 0.4) opts.push('right'); else if (cx > vw * 0.6) opts.push('left');
  opts.push('above', 'below', 'right', 'left');
  for (const o of opts) {
    let left, top;
    if (o === 'above') { left = cx - cardW() / 2; top = t.top - GAP - ch; }
    if (o === 'below') { left = cx - cardW() / 2; top = t.top + t.height + GAP; }
    if (o === 'right') { left = t.left + t.width + GAP; top = cy - ch / 2; }
    if (o === 'left') { left = t.left - GAP - cardW(); top = cy - ch / 2; }
    const fits = top >= M && top + ch <= vh - M && left >= M && left + cardW() <= vw - M;
    const nudged = { left: clamp(left, M, vw - cardW() - M), top: clamp(top, M, vh - ch - M) };
    // a horizontal nudge is fine for above/below; a vertical one for left/right
    if (fits || ((o === 'above' || o === 'below') && top >= M && top + ch <= vh - M) || ((o === 'left' || o === 'right') && left >= M && left + cardW() <= vw - M)) return nudged;
  }
  return { left: clamp(cx - cardW() / 2, M, vw - cardW() - M), top: clamp(t.top - ch - GAP, M, vh - ch - M) };
}

// nearest point of rect r to point p
const nearest = (r, x, y) => [Math.max(r.left, Math.min(r.left + r.width, x)), Math.max(r.top, Math.min(r.top + r.height, y))];

function Pointer({ card, t }) {
  if (!card || !t) return null;
  const tc = [t.left + t.width / 2, t.top + t.height / 2];
  const [x1, y1] = nearest(card, tc[0], tc[1]);
  let x2, y2;
  if (t.round) { const a = Math.atan2(y1 - tc[1], x1 - tc[0]); const r = t.width / 2 + PAD + 4; x2 = tc[0] + Math.cos(a) * r; y2 = tc[1] + Math.sin(a) * r; }
  else { [x2, y2] = nearest({ left: t.left - PAD - 4, top: t.top - PAD - 4, width: t.width + 2 * PAD + 8, height: t.height + 2 * PAD + 8 }, x1, y1); }
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 12) return null;
  const nx = -dy / len, ny = dx / len, bend = Math.min(40, len * 0.25);
  const qx = (x1 + x2) / 2 + nx * bend, qy = (y1 + y2) / 2 + ny * bend;
  const a = Math.atan2(y2 - qy, x2 - qx), h = 13;
  const head = `M${x2 - h * Math.cos(a - 0.5)} ${y2 - h * Math.sin(a - 0.5)} L${x2} ${y2} L${x2 - h * Math.cos(a + 0.5)} ${y2 - h * Math.sin(a + 0.5)}`;
  return (
    <g filter="url(#nm-tut-wobble)">
      <motion.path d={`M${x1} ${y1} Q${qx} ${qy} ${x2} ${y2}`} fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: 'easeOut' }} />
      <motion.path d={head} fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22, duration: 0.08 }} />
    </g>
  );
}

function Spot({ t, extra }) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const hole = (r, k) => (r.round
    ? <circle key={k} cx={r.left + r.width / 2} cy={r.top + r.height / 2} r={r.width / 2 + PAD} fill="black" />
    : <rect key={k} x={r.left - PAD} y={r.top - PAD} width={r.width + 2 * PAD} height={r.height + 2 * PAD} rx="18" fill="black" />);
  const ring = (r, k) => (r.round
    ? <motion.circle key={k} cx={r.left + r.width / 2} cy={r.top + r.height / 2} r={r.width / 2 + PAD} fill="none" stroke="var(--color-magenta)" strokeWidth="4" strokeDasharray="10 8"
        animate={{ strokeDashoffset: [0, -36] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
    : <motion.rect key={k} x={r.left - PAD} y={r.top - PAD} width={r.width + 2 * PAD} height={r.height + 2 * PAD} rx="18" fill="none" stroke="var(--color-magenta)" strokeWidth="4" strokeDasharray="10 8"
        animate={{ strokeDashoffset: [0, -36] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />);
  const rs = [t, extra].filter(Boolean);
  return (
    <>
      <defs>
        <filter id="nm-tut-soft"><feGaussianBlur stdDeviation="9" /></filter>
        <mask id="nm-tut-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={vw} height={vh}>
          <rect width={vw} height={vh} fill="white" />
          <g filter="url(#nm-tut-soft)">{rs.map(hole)}</g>
        </mask>
      </defs>
      <rect width={vw} height={vh} fill="var(--color-ink)" opacity={rs.length ? 0.2 : 0.1} mask="url(#nm-tut-mask)" />
      {rs.map(ring)}
    </>
  );
}

export default function Tutorial() {
  const G = useGame();
  const [tut, setTut] = useState(loadTut);
  const step = game.started ? activeStep(G, tut) : null;
  const stepRef = useRef(step);
  stepRef.current = step;

  const finish = useCallback((id) => setTut((t) => {
    if (t.done.includes(id)) return t;
    const n = { ...t, done: [...t.done, id] };
    saveTut(n);
    return n;
  }), []);
  const skipAll = () => setTut((t) => { const n = { ...t, off: true }; saveTut(n); return n; });

  // replay from the codex
  useEffect(() => onHud((e) => { if (e.type === 'tutReplay') { const n = { done: [], off: false }; saveTut(n); setTut(n); } }), []);
  // advance on real actions
  useEffect(() => onEvent((e, g) => { const s = stepRef.current; if (s?.on && s.on(e, g)) finish(s.id); }), [finish]);
  // advance on state
  useEffect(() => { if (step?.done && step.done(G)) finish(step.id); });
  // open the tab a step talks about
  useEffect(() => {
    if (step?.tab) emitHud({ type: 'tab', id: step.tab });
    else if (step && SHEET_OF[step.anchor]) emitHud({ type: 'sheet', id: SHEET_OF[step.anchor] });
  }, [step?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [touch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);

  // track the anchor (it moves: panels appear, layout shifts)
  const [rect, setRect] = useState(null);
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    if (!step) { setRect(null); setExtra(null); return undefined; }
    const upd = () => {
      const r = anchorRect(step.anchor), x = step.also ? anchorRect(step.also) : null;
      setRect((o) => (same(o, r) ? o : r));
      setExtra((o) => (same(o, x) ? o : x));
    };
    upd();
    const iv = setInterval(upd, 150);
    window.addEventListener('resize', upd);
    return () => { clearInterval(iv); window.removeEventListener('resize', upd); };
  }, [step?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardRef = useRef(null);
  const [ch, setCh] = useState(170);
  useLayoutEffect(() => { const h = cardRef.current?.offsetHeight; if (h && Math.abs(h - ch) > 1) setCh(h); });
  const pos = step ? placeCard(rect, ch, step.side, step.gap) : null;
  const card = pos && { left: pos.left, top: pos.top, width: cardW(), height: ch };
  const coreIdx = step ? CORE.findIndex((s) => s.id === step.id) : -1;
  const line = step && ((touch && step.touch) || step.plain);
  const plain = step && (typeof line === 'function' ? line(G) : line);

  return (
    <AnimatePresence>
      {step && (
        <motion.div key={step.id} className="pointer-events-none fixed inset-0 z-30"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.2 }}>
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <filter id="nm-tut-wobble" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
              </filter>
            </defs>
            <Spot t={rect} extra={extra} />
            <Pointer card={card} t={rect} />
          </svg>
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-label="guide"
            className="pointer-events-auto absolute rounded-[16px] border-[3px] border-ink bg-paper p-4 shadow-[4px_5px_0_0_var(--color-ink)]"
            style={{ width: cardW() }}
            initial={{ opacity: 0, scale: 0.92, y: 10, left: pos.left, top: pos.top }}
            animate={{ opacity: 1, scale: 1, y: 0, left: pos.left, top: pos.top }}
            transition={POP}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className={cn('h-3 w-3 rounded-full border-2 border-ink', step.intro ? 'bg-ultra' : 'bg-magenta')} />
              <span className="font-head text-[13px] leading-none tracking-wider text-ink-2 uppercase">
                {step.intro ? 'something new' : `the way in · ${coreIdx + 1} of ${CORE.length}`}
              </span>
            </div>
            <p className="font-body text-[16px] italic leading-snug text-ink-2">{step.voice}</p>
            <p className="mt-2 font-head text-[18px] leading-tight tracking-wide text-ink">{plain}</p>
            <div className="mt-3 flex items-center gap-3">
              {step.ack && <InkButton size="sm" tone="yolk" onClick={() => finish(step.id)}>got it</InkButton>}
              <span className="flex-1" />
              <button type="button" onClick={skipAll} className="font-body text-[13px] text-ink-2 underline decoration-ink-2/50 underline-offset-2 hover:text-ink">
                skip the guide
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
