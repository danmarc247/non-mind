// Codex: the systems, in the game's voice, one section per stage. Locked sections stay scrambled.
import { motion } from 'motion/react';
import { PretextFlow } from '../type/PretextFlow.jsx';
import { STAGES } from '../../game/index.js';
import { useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { InkButton, toneVar } from '../bits';
import { emitHud } from './bus.js';
import { useEffect, useMemo, useState } from 'react';
import { nudgesOn, setNudges } from './Nudge.jsx';
import { CODEX, CODEX_INTRO } from './text.js';
import { POP, scramble } from './shared.jsx';

const colW = () => Math.min(560, (typeof window !== 'undefined' ? window.innerWidth : 720) - 56); // text column: shrinks on phones
const DISC = 46; // radius of the painted disc each section flows around
const STAGE_TONES = ['rose', 'yolk', 'tangerine', 'teal', 'tangerine', 'ultra', 'violet', 'sky', 'blood', 'teal', 'magenta', 'sky', 'magenta', 'tangerine', 'leaf', 'ultra', 'violet', 'magenta'];

// rows that cross the disc stop short of it (or start after it)
const around = (side, COL) => (y, lh) => {
  const cy = DISC + 4;
  const near = Math.max(y, Math.min(cy, y + lh));
  const dy = near - cy;
  const reach = DISC + 14;
  if (Math.abs(dy) >= reach) return { left: 0, width: COL };
  const w = DISC + Math.sqrt(reach * reach - dy * dy); // disc centre sits DISC in from the edge
  return side === 'left' ? { left: w, width: COL - w } : { left: 0, width: COL - w };
};

function Section({ i, open, COL }) {
  const shape = useMemo(() => around(i % 2 ? 'right' : 'left', COL), [i, COL]);
  const side = i % 2 ? 'right' : 'left';
  const tone = STAGE_TONES[i];
  const text = open ? CODEX[i] : scramble(CODEX[i], 0.92, i * 13 + 5);
  return (
    <section className="relative mt-6" style={{ width: COL }}>
      <div className={cn('mb-1.5 flex items-baseline gap-2', side === 'right' && 'flex-row-reverse')}>
        <h3 className={cn('font-head text-[22px] leading-none uppercase', open ? 'text-ink' : 'text-ink-2/60')}>{open ? STAGES[i].id : scramble(STAGES[i].id, 0.9, i)}</h3>
        {open && <span className="font-body text-[13px] italic text-ink-2">{STAGES[i].hint}</span>}
      </div>
      <div className="relative">
        <span
          aria-hidden="true"
          className={cn('absolute top-1 rounded-full border-[3px] border-ink', side === 'left' ? 'left-0' : 'right-0', !open && 'opacity-30 saturate-0')}
          style={{ width: DISC * 2, height: DISC * 2, background: toneVar(tone), boxShadow: '3px 4px 0 0 var(--color-ink)' }}
        >
          <span className="absolute inset-[14px] rounded-full border-2 border-paper/70" />
          <span className="absolute inset-0 grid place-items-center font-title text-[30px] text-paper [text-shadow:2px_2px_0_var(--color-ink)]">{i + 1}</span>
        </span>
        <PretextFlow
          text={text}
          font={open ? '15px Fraunces' : 'italic 15px Fraunces'}
          lineHeight={22}
          width={COL}
          shape={shape}
          reveal={open}
          className={cn(!open && 'text-ink-2/45')}
          style={{ minHeight: DISC * 2 + 10 }}
        />
      </div>
    </section>
  );
}

function HintToggle() {
  const [on, setOn] = useState(nudgesOn);
  return (
    <InkButton size="sm" tone={on ? 'teal' : 'paper-2'} pressed={!on} onClick={() => { setNudges(!on); setOn(!on); }}>
      hints when idle: {on ? 'on' : 'off'}
    </InkButton>
  );
}

export default function Codex({ onClose }) {
  const G = useGame();
  const [COL, setCOL] = useState(colW);
  useEffect(() => { const on = () => setCOL(colW()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const narrow = COL < 520;
  return (
    <motion.div
      aria-modal="true"
      role="dialog"
      data-modal="codex"
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex max-h-[calc(100dvh-32px)] max-w-full flex-col overflow-hidden rounded-[28px] border-4 border-ink bg-paper shadow-[10px_12px_0_var(--color-ink)]"
        style={{ width: COL + (narrow ? 32 : 72) }}
        initial={{ opacity: 0, y: 24, scale: 0.95, rotate: -0.6 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.15, ease: 'easeIn' } }}
        transition={POP}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={cn('flex shrink-0 items-center gap-3 border-b-[3px] border-ink/15 pt-4 pb-3', narrow ? 'px-4' : 'px-9')}>
          <h2 className="font-title text-[40px] leading-none text-ink [text-shadow:3px_3px_0_var(--color-magenta)]">Codex</h2>
          <button type="button" onClick={onClose} className="ml-auto shrink-0 whitespace-nowrap rounded-full border-[3px] border-ink bg-yolk px-3 py-0.5 font-head text-sm text-ink shadow-[2px_3px_0_var(--color-ink)] hover:rotate-3 pointer-coarse:min-h-11">close · esc</button>
        </header>
        <div className={cn('nm-scroll overflow-y-auto overscroll-contain pb-8 [touch-action:pan-y]', narrow ? 'px-4' : 'px-9')}>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="min-w-[200px] flex-1 font-body text-[13px] italic leading-snug text-ink-2 [@media(max-height:500px)]:hidden">{CODEX_INTRO}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <InkButton size="sm" tone="yolk" onClick={() => { emitHud({ type: 'tutReplay' }); onClose(); }}>show the way again</InkButton>
              <HintToggle />
            </div>
          </div>
          {STAGES.map((_, i) => <Section key={i} i={i} open={i <= G.stage} COL={COL} />)}
        </div>
      </motion.div>
    </motion.div>
  );
}
