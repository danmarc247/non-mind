// Shared HUD pieces: appear motion, overwhelm degradation, hotkey badge, unit glyph thumbnails.
import { createContext, useContext } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { toneVar, toneHex } from '../bits';
import { HotKey } from '../bits/kit.jsx';
import { ASPECTS, FAMILY, aspectsOf, leaves, nameOf, tierOf } from '../../game/index.js';
import { FAMILY_PALETTES } from '../../gfx/palettes/families.js';

/* ------------------------------------------------------------ motion */

// Soft, quick, a little overshoot. Used for every progressive reveal.
export const POP = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };
export const EASE = { duration: 0.22, ease: [0.2, 0.9, 0.3, 1.15] };

export function Appear({ children, className, from = 'up', delay = 0, layout = false, ...rest }) {
  const off = { up: { y: 14 }, down: { y: -14 }, left: { x: -16 }, right: { x: 16 }, none: {} }[from];
  return (
    <motion.div
      layout={layout}
      className={className}
      initial={{ opacity: 0, scale: 0.94, ...off }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14, ease: 'easeIn' } }}
      transition={{ ...POP, delay, opacity: { duration: 0.18, delay } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------ overwhelm */

// { d: 0..1 degradation, tick: integer that advances while degraded }
export const DegradeCtx = createContext({ d: 0, tick: 0 });
export const useDegrade = () => useContext(DegradeCtx);

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz#%&*+=~/<>?';
function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function scramble(text, amount, seed = 0) {
  if (!amount || !text) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === ' ' || hash(i + 1, seed) > amount) out += c;
    else out += GLYPHS[Math.floor(hash(seed + 7, i) * GLYPHS.length)];
  }
  return out;
}
/** Text that scrambles under overwhelm. */
export function Scr({ children, k = 0 }) {
  const { d, tick } = useDegrade();
  if (typeof children !== 'string' || d < 0.05) return children;
  return scramble(children, Math.min(0.5, d * 0.42), tick * 31 + k);
}

/** Region wrapper: jitters and tilts in proportion to overwhelm. */
export function Shake({ children, className, seed = 1, style, ...rest }) {
  const { d } = useDegrade();
  const tilt = (hash(seed, 3) - 0.5) * 3.2 * d;
  return (
    <div
      {...rest}
      className={cn(className, d > 0.03 && 'nm-shake')}
      style={{
        ...style,
        '--tilt': `${tilt.toFixed(2)}deg`,
        '--amp': `${(d * 3.2).toFixed(2)}px`,
        animationDelay: `${-hash(seed, 9).toFixed(2)}s`,
        animationDuration: `${(0.28 + hash(seed, 5) * 0.2).toFixed(2)}s`,
        transform: d > 0.03 ? undefined : 'none',
      }}
    >
      {children}
    </div>
  );
}

export const HUD_CSS = `
@keyframes nm-shake {
  0%   { transform: translate(0, 0) rotate(var(--tilt)); }
  20%  { transform: translate(var(--amp), calc(var(--amp) * -0.6)) rotate(calc(var(--tilt) * 1.2)); }
  40%  { transform: translate(calc(var(--amp) * -0.8), calc(var(--amp) * 0.4)) rotate(var(--tilt)); }
  60%  { transform: translate(calc(var(--amp) * 0.3), var(--amp)) rotate(calc(var(--tilt) * 0.7)); }
  80%  { transform: translate(calc(var(--amp) * -0.4), calc(var(--amp) * -0.9)) rotate(calc(var(--tilt) * 1.1)); }
  100% { transform: translate(0, 0) rotate(var(--tilt)); }
}
.nm-shake { animation: nm-shake 0.33s steps(3, jump-none) infinite; transform-origin: 50% 50%; }
.nm-scroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--color-ink) 35%, transparent) transparent; }
.nm-tab { font-variant-numeric: tabular-nums; }
`;

/* ------------------------------------------------------------ badges */

// Hotkey badges come from the kit so every one is legible (Londrina, uppercase).
export function Key({ k, className }) {
  return <HotKey k={k} className={className} />;
}

export function Dot({ tone, className }) {
  return <span aria-hidden="true" className={cn('inline-block shrink-0 rounded-full border-2 border-ink', className)} style={{ background: toneVar(tone) }} />;
}

/** Small label in head font. */
export function Label({ children, className }) {
  return <span className={cn('font-head text-[13px] leading-none tracking-wider text-ink-2 uppercase', className)}>{children}</span>;
}

/* ------------------------------------------------------------ units */

export const aspectChips = (g) => aspectsOf(g).map((a) => ({ name: ASPECTS[a].name, tone: ASPECTS[a].tone }));
export const unitTone = (u) => ASPECTS[aspectsOf(u.g)[0]].tone;
export const unitName = (u) => nameOf(u.g);
export const unitTier = (u) => tierOf(u.g);

const PAPER = toneHex('paper');
const INKH = toneHex('ink');
const YOLK = toneHex('yolk');
const pal = (f) => {
  const p = FAMILY_PALETTES[f] || { a: INKH, b: toneHex('violet'), c: PAPER };
  const fix = (h) => (/^#f{6}$/i.test(h) ? PAPER : h); // pure white is not a token
  return { a: fix(p.a), b: fix(p.b), c: fix(p.c) };
};

// One painted mark per family form. Drawn in a 40x40 box centred on 20,20.
function FormMark({ form, a, b, c }) {
  const s = { stroke: INKH, strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' };
  switch (form) {
    case 'lens': return <g {...s}><path d="M4 20 Q20 2 36 20 Q20 38 4 20Z" fill={a} /><circle cx="20" cy="20" r="6" fill={b} /></g>;
    case 'slab': return <g {...s}><rect x="6" y="9" width="28" height="22" rx="3" fill={a} /><path d="M6 17 H34" stroke={b} strokeWidth="3" /></g>;
    case 'knot': return <g {...s}><path d="M20 6 C34 6 34 24 20 24 C8 24 8 34 20 34 C32 34 32 24 20 24 C6 24 6 6 20 6Z" fill={a} /><circle cx="20" cy="24" r="3.5" fill={c} /></g>;
    case 'shard': return <g {...s}><path d="M8 34 L18 4 L33 26 Z" fill={a} /><path d="M18 4 L22 30" stroke={b} /></g>;
    case 'rings': return <g {...s}><circle cx="20" cy="20" r="15" fill={a} /><circle cx="20" cy="20" r="9" fill={b} /><circle cx="20" cy="20" r="3.5" fill={c} /></g>;
    case 'spike': return <g {...s}><path d="M20 3 L25 15 L37 20 L25 25 L20 37 L15 25 L3 20 L15 15Z" fill={a} /><circle cx="20" cy="20" r="4" fill={b} /></g>;
    case 'shell': return <g {...s}><path d="M5 30 Q20 0 35 30 Z" fill={a} /><path d="M12 30 Q20 12 28 30" fill={b} /></g>;
    case 'flame': return <g {...s}><path d="M20 3 C28 13 33 18 31 27 C29 35 11 35 9 27 C8 20 14 18 15 11 C18 16 19 13 20 3Z" fill={a} /><path d="M20 18 C24 23 25 27 22 31 C19 33 15 30 16 26 C17 23 19 22 20 18Z" fill={b} /></g>;
    case 'bowl': return <g {...s}><path d="M4 14 H36 Q36 34 20 34 Q4 34 4 14Z" fill={a} /><path d="M9 14 Q20 22 31 14" fill={b} /></g>;
    case 'orbit': return <g {...s}><ellipse cx="20" cy="20" rx="16" ry="7" fill="none" stroke={b} strokeWidth="3" /><circle cx="20" cy="20" r="8" fill={a} /><circle cx="34" cy="17" r="3" fill={c} /></g>;
    default: return <circle cx="20" cy="20" r="12" fill={a} {...s} />;
  }
}

/** Unit thumbnail: every leaf of the genome as a painted mark, arranged around the strongest. */
export function UnitGlyph({ g, link, className, dots }) {
  const ls = leaves(g);
  const n = ls.length;
  const bg = pal(ls[0].f);
  const marks = ls.map((l, i) => {
    const p = pal(l.f);
    const f = FAMILY[l.f];
    if (n === 1) return { l, p, f, x: 30, y: 30, s: 1.05 };
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = n === 2 ? 11 : 15;
    return { l, p, f, x: 30 + Math.cos(a) * r, y: 30 + Math.sin(a) * r, s: n === 2 ? 0.72 : n <= 4 ? 0.55 : 0.45 };
  });
  return (
    <svg viewBox="0 0 60 60" className={cn('absolute inset-0 h-full w-full', className)} aria-hidden="true">
      <rect width="60" height="60" fill={bg.c} opacity="0.55" />
      <circle cx="30" cy="30" r="24" fill={bg.b} opacity="0.22" />
      {marks.map(({ l, p, f, x, y, s }, i) => (
        <g key={i} transform={`translate(${x - 20 * s} ${y - 20 * s}) scale(${s})`} opacity={l.pole < 0 ? 0.7 : 1}>
          <FormMark form={f.form} {...p} />
          {l.pole > 0 && <circle cx="34" cy="6" r="4" fill={YOLK} stroke={INKH} strokeWidth="2" />}
          {l.pole < 0 && <path d="M30 6 H38" stroke={INKH} strokeWidth="3" />}
        </g>
      ))}
      {dots && dots.map((t, i) => (
        <circle key={t + i} cx={54 - i * 9} cy={52} r={3.6} fill={toneHex(t)} stroke={INKH} strokeWidth="1.6" />
      ))}
      {link > 1 && (
        <g>
          <rect x="2" y="44" width={link >= 10 ? 20 : 15} height="13" rx="4" fill={PAPER} stroke={INKH} strokeWidth="2" />
          <text x={link >= 10 ? 12 : 9.5} y="54.2" textAnchor="middle" fontSize="10" fontFamily="Hypermonosaturation, monospace" fill={INKH}>{link}</text>
        </g>
      )}
    </svg>
  );
}
