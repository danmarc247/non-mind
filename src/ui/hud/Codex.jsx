// Codex: the systems, in the game's voice, one section per stage. Locked sections stay scrambled.
import { motion } from 'motion/react';
import { PretextFlow } from '../type/PretextFlow.jsx';
import { STAGES } from '../../game/index.js';
import { useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { InkButton, toneVar } from '../bits';
import { emitHud } from './bus.js';
import { useState } from 'react';
import { nudgesOn, setNudges } from './Nudge.jsx';
import { CODEX, CODEX_INTRO } from './text.js';
import { Key, POP, scramble } from './shared.jsx';

const COL = 560; // text column width (px)
const DISC = 46; // radius of the painted disc each section flows around
const STAGE_TONES = ['rose', 'yolk', 'tangerine', 'teal', 'tangerine', 'ultra', 'violet', 'sky', 'blood', 'teal', 'magenta', 'sky', 'magenta', 'tangerine', 'leaf', 'ultra', 'violet', 'magenta'];

// rows that cross the disc stop short of it (or start after it)
const around = (side) => (y, lh) => {
  const cy = DISC + 4;
  const near = Math.max(y, Math.min(cy, y + lh));
  const dy = near - cy;
  const reach = DISC + 14;
  if (Math.abs(dy) >= reach) return { left: 0, width: COL };
  const w = DISC + Math.sqrt(reach * reach - dy * dy); // disc centre sits DISC in from the edge
  return side === 'left' ? { left: w, width: COL - w } : { left: 0, width: COL - w };
};
const SHAPES = { left: around('left'), right: around('right') };

function Section({ i, open }) {
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
          shape={SHAPES[side]}
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
  return (
    <motion.div
      aria-modal="true"
      role="dialog"
      data-modal="codex"
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-ink/45"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex max-h-[calc(100vh-48px)] flex-col rounded-[22px] border-[3px] border-ink bg-paper shadow-[5px_7px_0_0_var(--color-ink)]"
        style={{ width: COL + 72 }}
        initial={{ opacity: 0, y: 24, scale: 0.95, rotate: -0.6 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.15, ease: 'easeIn' } }}
        transition={POP}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b-[3px] border-ink px-9 pt-5 pb-3">
          <h2 className="font-title text-[40px] leading-none text-ink [text-shadow:3px_3px_0_var(--color-magenta)]">Codex</h2>
          <p className="flex-1 font-body text-[13px] italic leading-snug text-ink-2">{CODEX_INTRO}</p>
          <div className="flex flex-col items-end gap-1.5">
            <InkButton size="sm" tone="yolk" onClick={() => { emitHud({ type: 'tutReplay' }); onClose(); }}>show the way again</InkButton>
            <HintToggle />
          </div>
          <button type="button" onClick={onClose} className="flex items-center gap-1.5 rounded-[8px] border-2 border-ink bg-paper px-2 py-1 font-head text-[13px] uppercase shadow-[1px_2px_0_0_var(--color-ink)] hover:-translate-y-[1px]">
            close <Key k="esc" />
          </button>
        </header>
        <div className="nm-scroll overflow-y-auto px-9 pb-8">
          {STAGES.map((_, i) => <Section key={i} i={i} open={i <= G.stage} />)}
        </div>
      </motion.div>
    </motion.div>
  );
}
