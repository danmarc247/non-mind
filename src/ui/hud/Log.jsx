// Quiet koan stack + centre-screen stage flash.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KoanFlash } from '../type/index.js';
import { STAGES } from '../../game/index.js';
import { onEvent, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { POP } from './shared.jsx';

const KIND_TONE = {
  stage: 'text-magenta', link: 'text-ultra', ending: 'text-leaf', warn: 'text-blood', op: 'text-ink', verb: 'text-violet', season: 'text-tangerine', reset: 'text-violet',
};

export function Log({ compact }) {
  const G = useGame();
  // fold repeats into one line with a count
  const folded = [];
  G.log.forEach((l, i) => {
    const prev = folded[folded.length - 1];
    if (prev && prev.text === l.text) { prev.n++; prev.i = i; } else folded.push({ ...l, n: 1, i });
  });
  const items = folded.slice(compact ? -4 : -5);
  return (
    <div className={cn('pointer-events-none flex flex-col justify-end gap-0.5', compact ? 'w-[280px]' : 'w-[316px]')} style={{ height: 'var(--log-h)' }}>
      <AnimatePresence initial={false}>
        {items.map((l, i) => {
          const age = items.length - 1 - i;
          return (
            <motion.p
              key={`${l.t}-${l.text}`}
              layout="position"
              initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
              animate={{ opacity: Math.max(0.28, 1 - age * 0.2), y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ ...POP, opacity: { duration: 0.25 } }}
              className={cn(
                'w-fit max-w-full rounded-[8px] bg-paper/80 px-2 py-[2px] font-body text-[12.5px] leading-snug italic',
                KIND_TONE[l.kind] || 'text-ink-2',
                age === 0 && 'shadow-[1px_1px_0_0_var(--color-ink)] ring-1 ring-ink/30',
              )}
            >
              {l.text}{l.n > 1 && <span className="ml-1.5 font-stat text-[11px] not-italic">x{l.n}</span>}
            </motion.p>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function StageFlash() {
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    let timer = 0;
    const off = onEvent((e) => {
      let text = null, hint = null, tone = 'magenta';
      if (e.type === 'stage') { text = STAGES[e.stage]?.id.toUpperCase(); hint = STAGES[e.stage]?.hint; }
      if (e.type === 'reset') { text = 'SIMPLE AGAIN'; tone = 'violet'; }
      if (e.type === 'ending') { text = 'AN ENDING'; tone = 'leaf'; }
      if (!text) return;
      clearTimeout(timer);
      setFlash({ text, hint, tone, key: performance.now() });
      timer = setTimeout(() => setFlash(null), 1600);
    });
    return () => { off(); clearTimeout(timer); };
  }, []);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.key}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.2 } }}
            transition={POP}
            className="w-[min(80vw,900px)]"
          >
            <KoanFlash
              text={flash.text}
              wpm={60}
              trail="rgb_split"
              tone={flash.tone}
              className="h-[120px] font-title text-[88px] text-ink [text-shadow:4px_5px_0_var(--color-paper)]"
            />
            {flash.hint && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...POP, delay: 0.15 }}
                className="mx-auto mt-1 w-fit rounded-[10px] bg-paper/85 px-3 py-1 text-center font-body text-[18px] italic text-ink-2"
              >
                {flash.hint}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
