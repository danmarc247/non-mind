// The ask button: a "?" ring with a speech bubble that asks something unrelated, in the player's voice.
// Pressing it (or ? / H) brings the next hint at once, whatever the question was.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RingButton } from '../bits/kit.jsx';
import { cn } from '../../lib/cn';
import { emitHud, onHud } from './bus.js';
import { QUESTIONS } from './text.js';
import { POP } from './shared.jsx';

const pick = (not) => { let q; do { q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]; } while (q === not && QUESTIONS.length > 1); return q; };

export default function Ask({ size = 56, bubble = 'left', className }) {
  const [q, setQ] = useState(() => QUESTIONS[0]);
  useEffect(() => {
    const t = setInterval(() => setQ((o) => pick(o)), 20000);
    const off = onHud((e) => { if (e.type === 'ask') setQ((o) => pick(o)); });
    return () => { clearInterval(t); off(); };
  }, []);
  return (
    <span data-tut="ask" className={cn('relative inline-flex', className)}>
      <RingButton tone="yolk" size={size} hotkey="?" hotkeyPos="corner" onClick={() => emitHud({ type: 'ask' })} label="ask for a hint">
        <span className="font-title leading-none" style={{ fontSize: size * 0.46 }}>?</span>
      </RingButton>
      <span className={cn('pointer-events-none absolute z-10', bubble === 'left' ? 'right-[calc(100%+10px)] top-1/2 -translate-y-1/2' : 'top-[calc(100%+8px)] right-0')}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={q}
            className="relative block w-max max-w-[190px] rounded-[12px] border-2 border-ink bg-paper px-2.5 py-1 font-body text-[14px] italic leading-snug text-ink shadow-[2px_3px_0_0_var(--color-ink)]"
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
            transition={POP}
          >
            {q}
            <span aria-hidden="true" className={cn('absolute h-2.5 w-2.5 rotate-45 border-ink bg-paper',
              bubble === 'left' ? '-right-[6px] top-1/2 -translate-y-1/2 border-t-2 border-r-2' : '-top-[6px] right-5 border-t-2 border-l-2')} />
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
