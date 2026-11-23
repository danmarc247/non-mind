// The log of arcane messages (with its arrival choreography) + centre-screen stage flash.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { KoanFlash } from '../type/index.js';
import { STAGES } from '../../game/index.js';
import { onEvent, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { POP } from './shared.jsx';

const KIND_TONE = {
  stage: 'text-magenta', link: 'text-ultra', ending: 'text-leaf', warn: 'text-blood', op: 'text-ink', verb: 'text-violet', season: 'text-tangerine', reset: 'text-violet',
};

const KIND_COLOR = {
  stage: 'magenta', link: 'ultra', ending: 'leaf', warn: 'blood', op: 'violet', verb: 'violet', season: 'tangerine', reset: 'violet', koan: 'ink-2',
};
const keyOf = (l) => `${l.t.toFixed(3)}:${l.text}`;
export const LOG_HEAD = 'what was said';

/* ---------------------------------------------------------- arrivals */

// Every new line (except stage lines, which have their own flash) first appears large in a clear
// area, holds, then flies into its place in the log through a shared layoutId.
const ArcaneCtx = createContext({ herald: null, pending: new Set(), reduced: false });
const HOLD = 2.2, HOLD_BUSY = 1.2, QUEUE = 3;

export function ArcaneProvider({ children }) {
  const G = useGame();
  const reduced = !!useReducedMotion();
  const seen = useRef(null);
  const [st, setSt] = useState({ herald: null, queue: [] });

  // spot new lines
  useEffect(() => {
    const items = G.log;
    if (!seen.current || seen.current.G !== G) { seen.current = { G, keys: new Set(items.map(keyOf)) }; return; } // a new run: nothing to announce
    const fresh = [];
    items.forEach((l, i) => {
      const k = keyOf(l);
      if (seen.current.keys.has(k)) return;
      seen.current.keys.add(k);
      const prev = items[i - 1];
      if (l.kind === 'stage' || reduced || (prev && prev.text === l.text)) return; // staged elsewhere, or a repeat that folds
      fresh.push({ key: k, text: l.text, kind: l.kind });
    });
    if (fresh.length) setSt((s) => ({ ...s, queue: [...s.queue, ...fresh].slice(-QUEUE) }));
  });

  // advance the queue
  useEffect(() => {
    if (!st.herald && st.queue.length) {
      setSt((s) => ({ herald: { ...s.queue[0], at: performance.now() }, queue: s.queue.slice(1) }));
      return undefined;
    }
    if (!st.herald) return undefined;
    const hold = (st.queue.length ? HOLD_BUSY : HOLD) * 1000 - (performance.now() - st.herald.at);
    const t = setTimeout(() => setSt((s) => ({ ...s, herald: null })), Math.max(0, hold));
    return () => clearTimeout(t);
  }, [st]);

  const value = useMemo(() => ({
    herald: st.herald, reduced,
    pending: new Set([...(st.herald ? [st.herald.key] : []), ...st.queue.map((q) => q.key)]),
  }), [st, reduced]);
  return <ArcaneCtx.Provider value={value}><LayoutGroup id="arcane">{children}</LayoutGroup></ArcaneCtx.Provider>;
}

function Underline({ tone }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 14" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-2 bottom-[-2px] h-[0.45em] w-[calc(100%+16px)]">
      <path d="M3 9 C 26 4, 50 12, 70 7 S 104 4, 117 8" fill="none" stroke={`var(--color-${tone})`} strokeWidth="8" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/** The prominent arrival, placed by the caller in a clear area of the arena. */
export function Herald({ size = 30 }) {
  const { herald } = useContext(ArcaneCtx);
  return (
    <div className="pointer-events-none flex justify-center">
      {herald && (
        <motion.p
          key={herald.key}
          layoutId={`arcane-${herald.key}`}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...POP, layout: { type: 'spring', stiffness: 170, damping: 21, mass: 0.9 } }}
          className="relative max-w-[min(620px,100%)] text-center font-body italic leading-[1.2] text-ink"
          style={{ fontSize: size, textShadow: '0 0 6px var(--color-paper), 0 0 14px var(--color-paper), 0 0 24px var(--color-paper)' }}
        >
          {/* the brush underline is painted as a per-line background so it spans every wrapped line fully
              (an absolutely positioned stroke inside an inline span only covered part of multi-line text) */}
          <span
            style={{
              backgroundImage: `linear-gradient(transparent 66%, color-mix(in srgb, var(--color-${KIND_COLOR[herald.kind] || 'ink-2'}) 50%, transparent) 66%, color-mix(in srgb, var(--color-${KIND_COLOR[herald.kind] || 'ink-2'}) 50%, transparent) 90%, transparent 90%)`,
              WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone', padding: '0 0.3em', borderRadius: '0.3em',
            }}
          >{herald.text}</span>
        </motion.p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- the log */

export function Log({ compact, mobile }) {
  const G = useGame();
  const { pending } = useContext(ArcaneCtx);
  // fold repeats into one line with a count; lines still being announced are not here yet
  const folded = [];
  G.log.forEach((l) => {
    const k = keyOf(l);
    const prev = folded[folded.length - 1];
    if (prev && prev.text === l.text) { prev.n++; return; }
    if (pending.has(k)) return;
    folded.push({ ...l, key: k, n: 1 });
  });
  const items = folded.slice(compact || mobile ? -2 : -3);
  const fs = mobile ? 15 : compact ? 16 : 18;
  return (
    <div className={cn('pointer-events-none flex flex-col justify-end', mobile ? 'w-[min(300px,70vw)]' : compact ? 'w-[300px]' : 'w-[340px]')} style={{ height: mobile ? undefined : 'var(--log-h)' }}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="h-2 w-2 rotate-45 border-[1.5px] border-ink bg-violet" />
        <span className="font-head text-[13px] leading-none tracking-wider text-ink-2 uppercase">{LOG_HEAD}</span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((l, i) => {
          const age = items.length - 1 - i;
          return (
            <motion.p
              key={l.key}
              layoutId={`arcane-${l.key}`}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: Math.max(0.35, 1 - age * 0.25) }}
              transition={{ opacity: { duration: 0.3 }, layout: { type: 'spring', stiffness: 170, damping: 21, mass: 0.9 } }}
              className={cn(
                'w-fit max-w-full rounded-[8px] bg-paper/80 px-2 py-[3px] font-body italic leading-snug [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden',
                KIND_TONE[l.kind] || 'text-ink-2',
                age === 0 && 'shadow-[1px_1px_0_0_var(--color-ink)] ring-1 ring-ink/30',
              )}
              style={{ fontSize: fs }}
              title={l.text}
            >
              {l.text}{l.n > 1 && <span className="ml-1.5 font-stat text-[12px] not-italic">x{l.n}</span>}
            </motion.p>
          );
        })}
      </div>
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
