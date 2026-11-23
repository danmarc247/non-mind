// The log of arcane messages, with its arrival choreography. (Stage unlocks, resets and endings are
// staged by the Ceremony overlay, so stage/reset/ending lines are never heralded large here.)
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { onEvent, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { POP } from './shared.jsx';

const KIND_COLOR = {
  stage: 'magenta', link: 'ultra', ending: 'leaf', warn: 'blood', op: 'violet', verb: 'violet', season: 'tangerine', reset: 'violet', koan: 'ink-2', gift: 'yolk',
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
      if (['stage', 'reset', 'ending'].includes(l.kind) || reduced || (prev && prev.text === l.text)) return; // staged by the Ceremony, or a repeat that folds
      fresh.push({ key: k, text: l.text, kind: l.kind });
    });
    if (fresh.length) setSt((s) => ({ ...s, queue: [...s.queue, ...fresh].slice(-QUEUE) }));
  });

  // the Ceremony has the stage for a few seconds after a stage, reset or ending: arrivals wait their turn
  const [ceremony, setCeremony] = useState(false);
  useEffect(() => {
    let t = 0;
    const off = onEvent((e) => { if (['stage', 'reset', 'ending'].includes(e.type)) { setCeremony(true); clearTimeout(t); t = setTimeout(() => setCeremony(false), 3200); } });
    return () => { off(); clearTimeout(t); };
  }, []);

  // advance the queue
  useEffect(() => {
    if (ceremony && !st.herald) return undefined;
    if (!st.herald && st.queue.length) {
      setSt((s) => ({ herald: { ...s.queue[0], at: performance.now() }, queue: s.queue.slice(1) }));
      return undefined;
    }
    if (!st.herald) return undefined;
    // tests may lengthen the hold and release it by hand: window.__arcaneDebug = { hold: seconds }; __arcaneDebug.release()
    const dbg = typeof window !== 'undefined' ? window.__arcaneDebug : null;
    if (dbg) dbg.release = () => setSt((s) => ({ ...s, herald: null }));
    const hold = (dbg?.hold ?? (st.queue.length ? HOLD_BUSY : HOLD)) * 1000 - (performance.now() - st.herald.at);
    const t = setTimeout(() => setSt((s) => ({ ...s, herald: null })), Math.max(0, hold));
    return () => clearTimeout(t);
  }, [st, ceremony]);

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
          className="relative max-w-[min(660px,100%)] rounded-[22px] border-[3px] border-ink bg-paper/95 px-6 py-3 text-center font-body italic leading-[1.25] text-ink shadow-[5px_6px_0_var(--color-ink)]"
          style={{ fontSize: size }}
        >
          {/* the brush underline is painted as a per-line background so it spans every wrapped line fully
              (an absolutely positioned stroke inside an inline span only covered part of multi-line text) */}
          <span
            style={{
              backgroundImage: `linear-gradient(transparent 84%, color-mix(in srgb, var(--color-${KIND_COLOR[herald.kind] || 'ink-2'}) 50%, transparent) 84%, color-mix(in srgb, var(--color-${KIND_COLOR[herald.kind] || 'ink-2'}) 50%, transparent) 97%, transparent 97%)`,
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
  const items = folded.slice(-3);
  const maxFs = mobile ? 15 : 19;
  const FLOOR = 13;
  const baseW = compact ? 300 : 340;

  // The newest three sentences are always shown whole. A hidden twin of the stack measures real rendered heights at
  // each candidate size (maxFs down to FLOOR px); the largest that fits the log's height wins. If none fits, the
  // stack widens a little, and only then does it drop to two entries (console.info once).
  const rootRef = useRef(null);
  const headRef = useRef(null);
  const twinRef = useRef(null);
  const warned = useRef(false);
  const [fit, setFit] = useState({ fs: maxFs, w: baseW, n: items.length });
  const sig = items.map((l) => `${l.key}:${l.n}`).join('|');
  useLayoutEffect(() => {
    const root = rootRef.current, twin = twinRef.current, head = headRef.current;
    if (!root || !twin || !head) return undefined;
    const run = () => {
      const kids = [...twin.children];
      if (mobile || !kids.length) { setFit((f) => (f.fs === maxFs && f.w === baseW && f.n === kids.length ? f : { fs: maxFs, w: baseW, n: kids.length })); return; }
      const avail = root.clientHeight - head.offsetHeight - 4;
      const total = (fs, w, n) => {
        twin.style.width = `${w}px`;
        kids.forEach((k, i) => { k.style.fontSize = `${fs}px`; k.style.display = i >= kids.length - n ? '' : 'none'; });
        let t = 0, c = 0;
        kids.forEach((k, i) => { if (i >= kids.length - n) { t += k.offsetHeight; c++; } });
        return t + Math.max(0, c - 1) * 4;
      };
      const search = (w, n) => { for (let fs = maxFs; fs >= FLOOR; fs--) if (total(fs, w, n) <= avail - 1) return fs; return 0; };
      let pick = null;
      for (const w of [baseW, baseW + 12]) { const fs = search(w, kids.length); if (fs) { pick = { fs, w, n: kids.length }; break; } }
      if (!pick && kids.length > 2) {
        const fs = search(baseW + 12, 2) || FLOOR;
        pick = { fs, w: baseW + 12, n: 2 };
        if (!warned.current) { warned.current = true; console.info('[log] three sentences do not fit at 13px; showing two'); }
      }
      if (!pick) pick = { fs: FLOOR, w: baseW + 12, n: kids.length };
      setFit((f) => {
        // hysteresis: keep the current size while it still fits and the gain would be a single pixel
        if (f.n === pick.n && f.w === pick.w && f.fs !== pick.fs && Math.abs(pick.fs - f.fs) <= 1 && total(f.fs, f.w, f.n) <= avail - 1) return f;
        return f.fs === pick.fs && f.w === pick.w && f.n === pick.n ? f : pick;
      });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(root);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, mobile, compact]);
  const shown = items.slice(-Math.max(1, fit.n));
  const fs = fit.fs;
  const lineCls = 'w-fit max-w-full rounded-[8px] bg-paper/90 py-[3px] pr-2 pl-2.5 font-body italic leading-[1.3] text-ink border-l-[5px]';
  return (
    <div ref={rootRef} className={cn('pointer-events-none relative flex shrink-0 flex-col justify-end', mobile ? 'w-[min(300px,70vw)]' : '')} style={{ height: mobile ? undefined : 'var(--log-h)', width: mobile ? undefined : fit.w }}>
      <div ref={twinRef} aria-hidden="true" className="invisible absolute inset-x-0 bottom-0 -z-10 flex flex-col gap-1">
        {items.map((l) => (
          <p key={l.key} className={lineCls} style={{ fontSize: fs }}>{l.text}{l.n > 1 && <span className="ml-1.5 font-stat text-[12px] not-italic">x{l.n}</span>}</p>
        ))}
      </div>
      <div ref={headRef} className="mb-1 flex items-center gap-1.5">
        <span className="h-2 w-2 rotate-45 border-[1.5px] border-ink bg-violet" />
        <span className="font-head text-[13px] leading-none tracking-wider text-ink-2 uppercase">{LOG_HEAD}</span>
      </div>
      <div className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
        {shown.map((l, i) => {
          const age = shown.length - 1 - i;
          return (
            <motion.p
              key={l.key}
              layoutId={`arcane-${l.key}`}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: Math.max(0.62, 1 - age * 0.19) }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ opacity: { duration: 0.3 }, layout: { type: 'spring', stiffness: 170, damping: 21, mass: 0.9 } }}
              className={cn(
                lineCls,
                age === 0 && 'shadow-[1px_1px_0_0_var(--color-ink)] ring-1 ring-ink/30',
              )}
              style={{ fontSize: fs, transition: 'font-size 0.18s ease-out', borderLeftColor: `var(--color-${KIND_COLOR[l.kind] || 'ink-2'})` }}
            >
              {l.text}{l.n > 1 && <span className="ml-1.5 font-stat text-[12px] not-italic">x{l.n}</span>}
            </motion.p>
          );
        })}
        </AnimatePresence>
      </div>
    </div>
  );
}
