// NON-MIND HUD kit: game-facing wrappers built from the ported Aceternity / Cult UI bits.
// Visual language: warm paper panels, 3px ink outlines, 3px/4px offset ink shadows,
// saturated acrylic accents. Radii: 18px containers, 12px buttons, 10px chips/slots.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { TextureCard, TextureSeparator } from './TextureCard';
import { TextureButton } from './TextureButton';
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
    <div className={cn('relative rounded-[18px]', className)}>
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

const INK_BUTTON_SIZE = { sm: 'sm', md: 'default', lg: 'lg' };
const INK_BUTTON_INNER = {
  sm: 'min-h-8 px-3 py-1 text-base',
  md: 'min-h-11 px-5 py-1.5 text-xl',
  lg: 'min-h-14 px-7 py-2 text-3xl',
};

export function InkButton({
  tone = 'yolk',
  size = 'md',
  disabled = false,
  pressed = false,
  onClick,
  children,
  hotkey,
  className,
  type = 'button',
  ...rest
}) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <TextureButton
        type={type}
        variant="paint"
        size={INK_BUTTON_SIZE[size] ?? 'default'}
        tone={disabled ? 'paper-2' : tone}
        disabled={disabled}
        aria-pressed={pressed || undefined}
        onClick={disabled ? undefined : onClick}
        className={cn(
          'select-none',
          pressed && 'translate-x-[2px] translate-y-[3px] shadow-[1px_1px_0_0_var(--color-ink)] hover:translate-y-[3px] hover:shadow-[1px_1px_0_0_var(--color-ink)]',
          disabled &&
            'cursor-not-allowed border-ink/40 shadow-[2px_2px_0_0_rgba(27,16,48,0.25)] hover:translate-y-0 hover:shadow-[2px_2px_0_0_rgba(27,16,48,0.25)] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_rgba(27,16,48,0.25)]',
        )}
        innerClassName={cn(
          INK_BUTTON_INNER[size] ?? INK_BUTTON_INNER.md,
          'uppercase tracking-wider',
          pressed && 'after:h-0 brightness-95',
          disabled &&
            'text-ink/40 before:hidden after:hidden bg-[repeating-linear-gradient(-45deg,rgba(27,16,48,0.07)_0_6px,transparent_6px_12px)]',
        )}
        {...rest}
      >
        {children}
      </TextureButton>
      {hotkey && (
        <kbd
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-2.5 -right-2.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-[6px] border-2 border-ink bg-paper px-1 font-stat text-[13px] leading-none text-ink shadow-[1px_2px_0_0_var(--color-ink)]',
            disabled && 'border-ink/40 text-ink/40 shadow-none',
          )}
        >
          {String(hotkey).toLowerCase()}
        </kbd>
      )}
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
        <span className="font-head text-[11px] tracking-wider text-ink-2 uppercase">{label}</span>
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

        <div className="mt-2 truncate px-0.5 font-head text-lg leading-none text-ink" title={name}>
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

function place(rect, side) {
  switch (side) {
    case 'bottom':
      return { left: rect.left + rect.width / 2, top: rect.bottom + GAP, transform: 'translate(-50%, 0)' };
    case 'left':
      return { left: rect.left - GAP, top: rect.top + rect.height / 2, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { left: rect.right + GAP, top: rect.top + rect.height / 2, transform: 'translate(0, -50%)' };
    default:
      return { left: rect.left + rect.width / 2, top: rect.top - GAP, transform: 'translate(-50%, -100%)' };
  }
}

const ARROW = {
  top: 'left-1/2 -bottom-[7px] -translate-x-1/2 border-r-[3px] border-b-[3px]',
  bottom: 'left-1/2 -top-[7px] -translate-x-1/2 border-l-[3px] border-t-[3px]',
  left: 'top-1/2 -right-[7px] -translate-y-1/2 border-r-[3px] border-t-[3px]',
  right: 'top-1/2 -left-[7px] -translate-y-1/2 border-l-[3px] border-b-[3px]',
};
const ENTER = { top: { y: 4 }, bottom: { y: -4 }, left: { x: 4 }, right: { x: -4 } };

export function Tooltip({ content, children, side = 'top', open: forcedOpen, className }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(false);
  const [rect, setRect] = useState(null);
  const open = (forcedOpen ?? hover) && content != null && content !== false;

  const measure = useCallback(() => {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
  }, []);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  const s = ARROW[side] ? side : 'top';

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <div
                key="tip"
                className="pointer-events-none fixed z-[1000]"
                style={place(rect, s)}
              >
                <motion.div
                  role="tooltip"
                  initial={{ opacity: 0, scale: 0.96, ...ENTER[s] }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className={cn(
                    'relative w-max max-w-[320px] rounded-[12px] border-[3px] border-ink bg-paper px-3 py-2 font-body text-sm leading-snug text-ink shadow-[3px_4px_0_0_var(--color-ink)]',
                    className,
                  )}
                >
                  <span aria-hidden="true" className={cn('absolute h-3 w-3 rotate-45 border-ink bg-paper', ARROW[s])} />
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
