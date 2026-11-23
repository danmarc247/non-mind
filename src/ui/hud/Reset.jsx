// The reset: NON-MIND. Visible from stage 1; pulses when overwhelm is full.
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InkButton, Tooltip } from '../bits';
import { muGain } from '../../game/index.js';
import { act, useGame } from '../../game/store.js';
import { fmt } from './fmt.js';
import { POP } from './shared.jsx';

export default function Reset() {
  const G = useGame();
  const [confirm, setConfirm] = useState(false);
  const gain = muGain(G);
  const full = G.overwhelm >= 1;
  return (
    <div className="pointer-events-auto relative flex flex-col items-end">
      <motion.div
        animate={full ? { scale: [1, 1.07, 1], rotate: [0, -1.5, 0] } : { scale: 1, rotate: 0 }}
        transition={full ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : POP}
        className="relative"
      >
        {full && (
          <motion.span
            className="pointer-events-none absolute -inset-2 rounded-[18px] border-[3px] border-magenta"
            animate={{ opacity: [0.9, 0], scale: [1, 1.25] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <Tooltip side="left" content={full ? 'It is too much. Letting go now keeps twice as much.' : 'Let all of this go. Mu remains, and makes the next time wider.'}>
          <InkButton tone={full ? 'magenta' : 'violet'} size="md" onClick={() => setConfirm((c) => !c)}>
            <span className="flex flex-col items-center leading-none">
              <span className="font-title text-[20px] tracking-normal normal-case">NON-MIND</span>
              <span className="mt-0.5 font-stat text-[13px] normal-case nm-tab">+{fmt(gain, { int: true })} mu</span>
            </span>
          </InkButton>
        </Tooltip>
      </motion.div>
      <AnimatePresence>
        {confirm && (
          <motion.div
            key="c"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } }}
            transition={POP}
            className="absolute top-full right-0 z-30 mt-3 w-[260px] rounded-[14px] border-[3px] border-ink bg-paper p-3 shadow-[3px_4px_0_0_var(--color-ink)]"
          >
            <p className="font-body text-[14px] leading-snug text-ink">
              Everything here becomes simple. You keep <b className="font-stat">{fmt(gain, { int: true })} mu</b>{G.endings ? ' and every ending' : ''}.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <InkButton size="sm" tone="paper" onClick={() => setConfirm(false)}>not yet</InkButton>
              <InkButton size="sm" tone="magenta" onClick={() => { setConfirm(false); act('nonMind'); }}>let go</InkButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
