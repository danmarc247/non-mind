// NON-MIND HUD kit: game-facing wrappers built from the ported Aceternity / Cult UI bits.
// Visual language: warm paper panels, 3px ink outlines, 3px/4px offset ink shadows,
// saturated acrylic accents. Radii: 18px containers, 12px buttons, 10px chips/slots.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { TextureCard, TextureSeparator } from './TextureCard';
import { GlowingEffect } from './GlowingEffect';
import { EncryptedText } from './EncryptedText';
import { CardSpotlight } from './CardSpotlight';
import { TIER_TONE, toneRgb, toneVar } from './tones';

const INK = 'var(--color-ink, #1b1030)';
const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/* ------------------------------------------------------------------ Panel */

/** Hand-painted highlighter stroke drawn under headings. */
function BrushStroke({ tone, className }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 14"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute -inset-x-1.5 bottom-[-3px] h-[0.62em] w-[calc(100%+12px)]', className)}
    >
      <path
        d="M3 9.5 C 22 4.5, 44 11.5, 64 7 S 104 4, 117 8.5"
        fill="none"
        stroke={toneVar(tone)}
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function Panel({ title, tone = 'magenta', children, className, glow = false, bodyClassName, actions }) {
  return (
    <div data-panel="" className={cn('relative rounded-[18px]', className)}>
      {glow && (
        <GlowingEffect
          disabled={false}
          glow
          tone={tone}
          spread={38}
          proximity={72}
          inactiveZone={0.05}
          borderWidth={4}
          movementDuration={1.2}
        />
      )}
      <TextureCard className="h-full">
        {title != null && (
          <>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-ink"
                style={{ background: toneVar(tone) }}
              />
              <h3 className="relative font-head text-xl leading-none tracking-wider text-ink uppercase">
                <BrushStroke tone={tone} className="opacity-45" />
                <span className="relative">{title}</span>
              </h3>
              {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
            </div>
            <TextureSeparator />
          </>
        )}
        <div className={cn('px-4 py-3 font-body text-ink', bodyClassName)}>{children}</div>
      </TextureCard>
    </div>
  );
}

/* -------------------------------------------------------------- InkButton */

// Paint chips: every button is a hand-cut scrap of painted paper. The outline is a jittered
// polygon seeded by the label, so the same button keeps its shape and no two look alike.
function textOf(v) {
  if (v == null || typeof v === 'boolean') return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(textOf).join('');
  return textOf(v.props?.children);
}
function seedOf(v) {
  const s = textOf(v) || 'x';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rand(seed) {
  let a = seed || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Torn paper-chip outline in a 100x100 box (stretched to the button with non-scaling strokes). */
export function chipPath(seed, { jag = 1 } = {}) {
  const r = rand(seed);
  const j = (n) => (r() - 0.5) * 2 * n * jag;
  const pts = [];
  const m = 4; // margin for the stroke
  const c = () => 3 + r() * 7; // cut corner
  const tl = c(), tr = c(), br = c(), bl = c();
  pts.push([m + tl * 0.5 + j(1), m + j(2)]);
  for (let i = 1; i < 6; i++) pts.push([m + (i / 6) * (100 - 2 * m) + j(3), m + j(4)]);
  pts.push([100 - m - tr * 0.5 + j(1), m + j(2)], [100 - m + j(1.5), m + tr + j(2)]);
  for (let i = 1; i < 3; i++) pts.push([100 - m + j(1.6), m + (i / 3) * (100 - 2 * m) + j(4)]);
  pts.push([100 - m + j(1.5), 100 - m - br + j(2)], [100 - m - br * 0.5 + j(1), 100 - m + j(2)]);
  for (let i = 5; i > 0; i--) pts.push([m + (i / 6) * (100 - 2 * m) + j(3), 100 - m + j(4)]);
  pts.push([m + bl * 0.5 + j(1), 100 - m + j(2)], [m + j(1.5), 100 - m - bl + j(2)]);
  for (let i = 2; i > 0; i--) pts.push([m + j(1.6), m + (i / 3) * (100 - 2 * m) + j(4)]);
  pts.push([m + j(1.5), m + tl + j(2)]);
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
}

const LIGHT = new Set(['paper', 'paper-2', 'yolk', 'tangerine', 'teal', 'leaf', 'rose', 'sky']);
const INK_BUTTON_SIZES = {
  sm: 'min-h-[34px] px-3.5 py-1 text-[15px] pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]',
  md: 'min-h-[44px] px-5 py-1.5 text-[19px]',
  lg: 'min-h-[58px] px-8 py-2 text-[28px]',
};
const SOFT = { type: 'spring', stiffness: 700, damping: 24, mass: 0.6 };

/** Legible hotkey badge (Londrina, uppercase, ink on paper). */
export function HotKey({ k, className, dim }) {
  const label = String(k).length > 1 ? String(k).toUpperCase() : String(k).toUpperCase();
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        'pointer-events-none inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[7px] border-2 border-ink bg-paper px-1.5 font-head text-[14px] leading-none tracking-wide text-ink shadow-[1px_2px_0_0_var(--color-ink)] pointer-coarse:hidden',
        dim && 'border-ink/40 text-ink/50 shadow-none',
        className,
      )}
    >
      {label}
    </kbd>
  );
}

export function InkButton({
  tone = 'yolk',
  size = 'md',
  disabled = false,
  pressed = false,
  onClick,
  children,
  hotkey,
  className,
  full = false,
  seed,
  type = 'button',
  ...rest
}) {
  const sd = seed ?? seedOf(children);
  const d = useMemo(() => chipPath(sd), [sd]);
  const tilt = useMemo(() => (rand(sd ^ 0x9e37)() - 0.5) * 2.4, [sd]);
  const face = disabled ? 'paper-2' : tone;
  const text = disabled ? 'text-ink/60' : LIGHT.has(face) ? 'text-ink' : 'text-paper';
  const hatchId = `nm-hatch-${sd}`;
  return (
    <span className={cn('relative inline-flex', full && 'flex w-full', className)} style={{ rotate: `${tilt}deg` }}>
      <motion.button
        type={type}
        disabled={disabled}
        aria-pressed={pressed || undefined}
        onClick={disabled ? undefined : onClick}
        className={cn(
          'group relative inline-flex select-none items-center justify-center font-head leading-none tracking-wider uppercase outline-none',
          INK_BUTTON_SIZES[size] ?? INK_BUTTON_SIZES.md,
          full && 'w-full',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
        whileHover={disabled ? undefined : { rotate: [0, -2.2, 1.6, 0], transition: { duration: 0.26, ease: 'easeOut' } }}
        whileTap={disabled ? undefined : { scaleX: 1.06, scaleY: 0.86, transition: { duration: 0.12 } }}
        transition={SOFT}
        {...rest}
      >
        {/* ink cut-out shadow */}
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"
          className={cn('pointer-events-none absolute inset-0 h-full w-full transition-transform duration-150 ease-out',
            pressed ? 'translate-x-[1px] translate-y-[1px]' : disabled ? 'translate-x-[2px] translate-y-[2px]' : 'translate-x-[3px] translate-y-[4px] group-active:translate-x-[1px] group-active:translate-y-[1px]')}>
          <path d={d} fill={disabled ? 'color-mix(in srgb, var(--color-ink) 22%, transparent)' : INK} />
        </svg>
        {/* paint face */}
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"
          className={cn('pointer-events-none absolute inset-0 h-full w-full transition-transform duration-150 ease-out',
            pressed ? 'translate-x-[2px] translate-y-[3px]' : !disabled && 'group-active:translate-x-[2px] group-active:translate-y-[3px]')}>
          {disabled && (
            <defs>
              <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <rect width="3" height="6" fill="var(--color-ink)" opacity="0.08" />
              </pattern>
            </defs>
          )}
          <path d={d} fill={toneVar(face)} stroke={disabled ? 'color-mix(in srgb, var(--color-ink) 40%, transparent)' : INK} strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {disabled && <path d={d} fill={`url(#${hatchId})`} />}
          {!disabled && <path d="M14 22 C 34 16, 60 18, 84 21" fill="none" stroke="var(--color-paper)" strokeOpacity={LIGHT.has(face) ? 0.55 : 0.35} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        </svg>
        <span className={cn('relative inline-flex items-center gap-1 transition-transform duration-150 ease-out', text,
          pressed ? 'translate-x-[2px] translate-y-[3px]' : !disabled && 'group-active:translate-x-[2px] group-active:translate-y-[3px]')}>
          {children}
        </span>
      </motion.button>
      {hotkey && <HotKey k={hotkey} dim={disabled} className="absolute -top-2.5 -right-2.5 z-10" />}
    </span>
  );
}

/** Ring control (ref b: flat colour disc, white rings, ink outline). */
export function RingButton({ tone = 'magenta', size = 96, children, onClick, hotkey, hotkeyPos = 'bottom', className, disabled, label, ...rest }) {
  const inkText = LIGHT.has(tone);
  return (
    <span className={cn('relative inline-flex flex-col items-center', className)}>
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
        className={cn('group relative grid place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-yolk', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
        style={{ width: size, height: size }}
        whileHover={disabled ? undefined : { rotate: [0, -4, 3, 0], scale: 1.04, transition: { duration: 0.26, ease: 'easeOut' } }}
        whileTap={disabled ? undefined : { scaleX: 1.08, scaleY: 0.88, transition: { duration: 0.12 } }}
        transition={SOFT}
        {...rest}
      >
        <span aria-hidden="true" className="absolute inset-0 translate-x-[3px] translate-y-[4px] rounded-full bg-ink transition-transform duration-150 group-active:translate-x-[1px] group-active:translate-y-[1px]" />
        <span aria-hidden="true" className="absolute inset-0 rounded-full border-[3px] border-ink transition-transform duration-150 group-active:translate-x-[2px] group-active:translate-y-[3px]" style={{ background: toneVar(tone) }}>
          <span className="absolute inset-[9%] rounded-full border-[2.5px] border-paper/90" />
          <span className="absolute inset-[22%] rounded-full border-2 border-paper/45" />
          <span className="absolute top-[12%] left-[20%] h-[16%] w-[30%] -rotate-[24deg] rounded-full bg-paper/30" />
        </span>
        <span className={cn('relative flex flex-col items-center leading-none transition-transform duration-150 group-active:translate-x-[2px] group-active:translate-y-[3px]', inkText ? 'text-ink' : 'text-paper [text-shadow:1px_2px_0_var(--color-ink)]')}>
          {children}
        </span>
      </motion.button>
      {hotkey && <HotKey k={hotkey} className={hotkeyPos === 'bottom' ? 'mt-2' : 'absolute -top-1 -right-1 z-10'} />}
    </span>
  );
}

/* --------------------------------------------------------------- StatChip */

export function StatChip({ label, value, tone = 'ultra', hint, className }) {
  const chip = (
    <div
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-[10px] border-[3px] border-ink bg-paper shadow-[2px_3px_0_0_var(--color-ink)]',
        className,
      )}
    >
      <span aria-hidden="true" className="w-2 shrink-0 border-r-2 border-ink" style={{ background: toneVar(tone) }} />
      <span className="flex flex-col justify-center gap-0.5 px-2 py-1 leading-none">
        <span className="font-head text-[11px] pointer-coarse:text-[12px] tracking-wider text-ink-2 uppercase">{label}</span>
        <span className="font-stat text-xl leading-none text-ink">{value}</span>
      </span>
    </div>
  );
  return hint ? <Tooltip content={hint}>{chip}</Tooltip> : chip;
}

/* ------------------------------------------------------------------ Meter */

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h % 97) + 1;
}

export function Meter({ value = 0, tone = 'teal', label, danger = false, showValue = true, format, className }) {
  const v = clamp01(value);
  const rawId = useId();
  const id = `nm-wob-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const seed = useMemo(() => hashSeed(id), [id]);
  const fillTone = danger ? 'blood' : tone;

  return (
    <div className={cn('w-full', className)}>
      {(label != null || showValue) && (
        <div className="mb-1 flex items-end justify-between gap-2 leading-none">
          <span className={cn('font-head text-sm tracking-wider uppercase', danger ? 'text-blood' : 'text-ink')}>
            {label}
          </span>
          {showValue && (
            <span className={cn('font-stat text-base leading-none', danger ? 'text-blood' : 'text-ink')}>
              {format ? format(v) : `${Math.round(v * 100)}%`}
            </span>
          )}
        </div>
      )}
      <div
        className="relative h-5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <div className="absolute inset-[3px] overflow-hidden rounded-[7px] bg-paper-2">
          {/* trailing ghost: shows how much was just lost */}
          <motion.div
            className="absolute inset-0 origin-left bg-ink/20"
            initial={false}
            animate={{ scaleX: v }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.2, 0.7, 0.3, 1] }}
          />
          <motion.div
            className="absolute inset-0 origin-left"
            style={{ background: toneVar(fillTone) }}
            initial={false}
            animate={{ scaleX: v }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
          />
          {danger && (
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg, rgba(27,16,48,0.28) 0 5px, transparent 5px 11px)',
              }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {/* quarter ticks + gloss */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, transparent calc(25% - 1px), rgba(27,16,48,0.18) calc(25% - 1px) 25%, transparent 25% calc(50% - 1px), rgba(27,16,48,0.18) calc(50% - 1px) 50%, transparent 50% calc(75% - 1px), rgba(27,16,48,0.18) calc(75% - 1px) 75%, transparent 75%)',
            }}
          />
          <div className="absolute inset-x-1.5 top-[2px] h-[32%] rounded-full bg-white/35" />
        </div>
        {/* wobbly hand-drawn outline */}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <filter id={id} x="-4%" y="-50%" width="108%" height="200%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.09" numOctaves="2" seed={seed} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <rect
            x="1.5"
            y="1.5"
            rx="9"
            ry="9"
            style={{ width: 'calc(100% - 3px)', height: 'calc(100% - 3px)' }}
            fill="none"
            stroke={INK}
            strokeWidth="3"
            filter={`url(#${id})`}
          />
        </svg>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Cryptic */

const CRYPTIC_CHARSET = 'abcdefghijklmnopqrstuvwxyz*+=~/\\<>?!#%&';

export function Cryptic({ text, className, tone = 'magenta', revealDelayMs = 28, flipDelayMs = 60 }) {
  return (
    <span className={cn('font-body text-ink-2 italic', className)} style={{ '--cry': toneVar(tone) }}>
      <EncryptedText
        text={text}
        charset={CRYPTIC_CHARSET}
        revealDelayMs={revealDelayMs}
        flipDelayMs={flipDelayMs}
        encryptedClassName="text-(--cry) opacity-75 not-italic"
        revealedClassName=""
      />
    </span>
  );
}

/* --------------------------------------------------------------- UnitCard */

function PaintDot({ tone, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0 rounded-full border-2 border-ink', className)}
      style={{ background: toneVar(tone) }}
    />
  );
}

export function UnitCard({
  name,
  tier = 1,
  aspects = [],
  cost,
  stars = 0,
  selected = false,
  dim = false,
  onClick,
  children,
  className,
  reveal = true,
}) {
  const t = Math.max(1, Math.min(5, Math.round(tier)));
  const tierTone = TIER_TONE[t];
  const shadow = selected
    ? `0 0 0 2px ${INK}, 0 0 0 6px var(--color-magenta), 5px 8px 0 4px ${INK}`
    : `0 0 0 2px ${INK}, 4px 5px 0 2px ${INK}`;
  const interactive = !!onClick && !dim;

  return (
    <CardSpotlight
      tone={tierTone === 'ink' ? 'violet' : tierTone}
      radius={130}
      reveal={reveal}
      revealColors={[toneRgb(tierTone === 'ink' ? 'magenta' : tierTone), toneRgb('magenta')]}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-disabled={dim || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={cn(
        'w-[136px] rounded-[16px] border-[4px] p-2 transition-[transform,opacity,filter] duration-150 ease-out outline-none',
        interactive && 'cursor-pointer hover:-translate-y-1 focus-visible:-translate-y-1',
        selected && '-translate-y-1.5 hover:-translate-y-1.5',
        dim && 'opacity-45 saturate-[0.35]',
        className,
      )}
      style={{ borderColor: toneVar(tierTone), boxShadow: shadow }}
    >
      <div className="relative z-10">
        {/* thumbnail slot */}
        <div className="relative aspect-square w-full overflow-hidden rounded-[10px] border-[3px] border-ink bg-paper-2">
          {children ?? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg, rgba(27,16,48,0.07) 0 6px, transparent 6px 12px)',
              }}
            />
          )}
          <span
            className="absolute top-1 right-1 rounded-[6px] border-2 border-ink px-1 font-stat text-[12px] leading-[14px]"
            style={{ background: toneVar(tierTone), color: tierTone === 'ink' || tierTone === 'ultra' || tierTone === 'violet' ? 'var(--color-paper)' : INK }}
          >
            t{t}
          </span>
        </div>

        <div className="mt-2 line-clamp-2 min-h-[2.1em] px-0.5 font-head text-lg leading-[1.05] break-words text-ink" title={name}>
          {name}
        </div>

        {aspects.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 px-0.5">
            {aspects.map((a) => (
              <span key={a.name} className="inline-flex items-center gap-1 leading-none">
                <PaintDot tone={a.tone} className="h-2.5 w-2.5 border-[1.5px]" />
                <span className="font-head text-xs tracking-wide text-ink-2">{a.name}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between px-0.5">
          <span className="flex items-center gap-[3px]" aria-label={stars ? `${stars} star${stars > 1 ? 's' : ''}` : undefined}>
            {Array.from({ length: Math.max(0, Math.min(5, stars)) }, (_, i) => (
              <PaintDot key={i} tone="yolk" className="h-3 w-3 shadow-[1px_1px_0_0_var(--color-ink)]" />
            ))}
          </span>
          {cost != null && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-yolk px-1.5 font-stat text-[15px] leading-none text-ink shadow-[1px_2px_0_0_var(--color-ink)]">
              {cost}
            </span>
          )}
        </div>
      </div>
    </CardSpotlight>
  );
}

/* ---------------------------------------------------------------- Tooltip */

const GAP = 10;
const EDGE = 8; // keep this far from the viewport edge

const ENTER = { top: { y: 4 }, bottom: { y: -4 }, left: { x: 4 }, right: { x: -4 } };
const FLIP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

// Place a measured tip next to `rect`: prefer `side`, flip when it would leave the viewport, clamp the rest.
function placeTip(rect, side, tw, th) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const room = { top: rect.top, bottom: vh - rect.bottom, left: rect.left, right: vw - rect.right };
  const need = side === 'top' || side === 'bottom' ? th + GAP + EDGE : tw + GAP + EDGE;
  let s = side;
  if (room[s] < need && room[FLIP[s]] > room[s]) s = FLIP[s];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (s === 'top' || s === 'bottom') {
    const cx = rect.left + rect.width / 2;
    const left = clamp(cx - tw / 2, EDGE, vw - tw - EDGE);
    const top = s === 'top' ? Math.max(EDGE, rect.top - GAP - th) : Math.min(vh - th - EDGE, rect.bottom + GAP);
    return { side: s, left, top, arrow: clamp(cx - left, 14, tw - 14) };
  }
  const cy = rect.top + rect.height / 2;
  const top = clamp(cy - th / 2, EDGE, vh - th - EDGE);
  const left = s === 'left' ? Math.max(EDGE, rect.left - GAP - tw) : Math.min(vw - tw - EDGE, rect.right + GAP);
  return { side: s, left, top, arrow: clamp(cy - top, 14, th - 14) };
}

const ARROW_EDGE = {
  top: '-bottom-[7px] -translate-x-1/2 border-r-[3px] border-b-[3px]',
  bottom: '-top-[7px] -translate-x-1/2 border-l-[3px] border-t-[3px]',
  left: '-right-[7px] -translate-y-1/2 border-r-[3px] border-t-[3px]',
  right: '-left-[7px] -translate-y-1/2 border-l-[3px] border-b-[3px]',
};

/**
 * Hover/focus tooltip in a portal. It measures itself, flips to the other side when there is no
 * room (top-bar chips open downward), and clamps into the viewport. pointer-events: none.
 */
export function Tooltip({ content, children, side = 'top', open: forcedOpen, className, wrapperClassName }) {
  const ref = useRef(null);
  const tipRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState(null);
  const touchRef = useRef(false);
  const open = (forcedOpen ?? hover) && content != null && content !== false;
  // touch: a tap toggles the tip, a tap anywhere else closes it (no hover on touch screens)
  useEffect(() => {
    if (!hover || !touchRef.current) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setHover(false); };
    document.addEventListener('pointerdown', away, true);
    const t = setTimeout(() => setHover(false), 4000);
    return () => { document.removeEventListener('pointerdown', away, true); clearTimeout(t); };
  }, [hover]);
  const want = ENTER[side] ? side : 'top';

  const measure = useCallback(() => {
    const el = ref.current, tip = tipRef.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const p = placeTip(r, want, tip.offsetWidth, tip.offsetHeight);
    setPos((o) => (o && o.side === p.side && Math.abs(o.left - p.left) < 0.5 && Math.abs(o.top - p.top) < 0.5 && Math.abs(o.arrow - p.arrow) < 0.5 ? o : p));
  }, [want]);

  // re-measure after every render while open (content may change size); setPos bails out when unchanged
  useLayoutEffect(() => { if (open) measure(); });
  useEffect(() => {
    if (!open) { setPos(null); return undefined; }
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  const s = pos?.side || want;
  const horiz = s === 'top' || s === 'bottom';

  return (
    <span
      ref={ref}
      className={cn('relative inline-flex', wrapperClassName)}
      onPointerDown={(e) => { touchRef.current = e.pointerType !== 'mouse'; }}
      onClick={() => { if (touchRef.current) setHover((h) => !h); }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(false); }}
      onFocus={() => { if (!touchRef.current) setHover(true); }}
      onBlur={() => setHover(false)}
    >
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div
                key="tip"
                ref={tipRef}
                className="pointer-events-none fixed z-[1000]"
                style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
              >
                <motion.div
                  role="tooltip"
                  initial={{ opacity: 0, scale: 0.96, ...ENTER[s] }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className={cn(
                    'relative w-max max-w-[320px] rounded-[10px] border-[3px] border-ink bg-paper px-3 py-2 font-body text-sm leading-snug text-ink shadow-[3px_4px_0_0_var(--color-ink)]',
                    className,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('absolute h-3 w-3 rotate-45 border-ink bg-paper', ARROW_EDGE[s])}
                    style={horiz ? { left: pos?.arrow ?? '50%' } : { top: pos?.arrow ?? '50%' }}
                  />
                  <div className="relative">{content}</div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  );
}
