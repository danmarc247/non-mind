// Lineage: a living map of everything grown this run, as a paper folio over the game.
// Toggle: window event `nonmind:lineage` or key L. Esc closes. Pixi is lazy-loaded only while open.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { game, select, useVersion } from '../game/store.js';
import { startLineageLog } from './lineage/log.js';
import { LINEAGE_TEXT as TX } from './lineage/text.js';

startLineageLog(); // the memory starts with the page, not with the first opening

let live = null; // the one Pixi scene allowed at a time (a promise while it boots)
let current = null;

function Map2D() {
  const host = useRef(null);
  const scene = useRef(null);
  const [tip, setTip] = useState(null);
  const [failed, setFailed] = useState(false);
  const version = useVersion();
  useEffect(() => {
    let dead = false, mine = null;
    (async () => {
      try {
        if (live) { await live.catch(() => {}); }
        if (dead) return;
        const p = import('./lineage/scene.js').then((m) => m.createLineageScene(host.current, {
          getGame: () => game.G,
          getSelected: () => game.selected,
          onHover: setTip,
          onSelect: (id) => { if (game.selected !== id) select(id); },
        }));
        live = p;
        mine = await p;
        if (dead) { mine.destroy(); mine = null; live = null; return; }
        scene.current = mine; current = mine;
        if (typeof window !== 'undefined') window.__lineage = mine;
      } catch (err) { console.warn('lineage: pixi unavailable', err); setFailed(true); live = null; }
    })();
    return () => {
      dead = true;
      if (mine) { mine.destroy(); mine = null; live = null; }
      scene.current = null; current = null;
      if (typeof window !== 'undefined') window.__lineage = null;
    };
  }, []);
  useEffect(() => { scene.current?.sync(); }, [version]);
  const empty = !game.G?.units?.length;
  return (
    <div ref={host} className="absolute inset-0 overflow-hidden">
      {failed && <p className="absolute inset-0 m-auto h-fit w-fit font-body italic text-ink-2">{TX.empty}</p>}
      {empty && !failed && <p className="pointer-events-none absolute inset-x-0 bottom-40 px-4 text-center sm:bottom-24 font-body text-sm italic text-ink-2">{TX.empty}</p>}
      <AnimatePresence>
        {tip && (
          <motion.div key="tip" initial={{ opacity: 0, scale: 0.94, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.7 }}
            className="pointer-events-none absolute z-10 max-w-[300px] rounded-[10px] border-[3px] border-ink bg-paper px-3 py-2 shadow-[3px_4px_0_var(--color-ink)]"
            style={{ left: Math.min(tip.x + 16, (host.current?.clientWidth || 999) - 310), top: tip.y + 16 }}>
            <div className="font-head text-[15px] leading-tight text-ink">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-ink align-middle" style={{ background: `var(--color-${tip.tone})`, opacity: tip.ghost ? 0.5 : 1 }} />
              {tip.title}
            </div>
            {tip.note && <div className="mt-0.5 font-body text-[13px] italic leading-snug text-ink-2">{tip.note}</div>}
            <div className="mt-1 font-stat text-[11px] text-ink-2">{tip.ghost ? 'gone' : tip.meta}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legend() {
  const Sw = ({ d, stroke, w = 4, dash }) => (
    <svg viewBox="0 0 34 10" className="h-2.5 w-9"><path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} /></svg>
  );
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap sm:bottom-4 sm:left-5 sm:max-w-[calc(100%-260px)] items-center gap-x-4 gap-y-1 rounded-full border-[3px] border-ink bg-paper/90 px-4 py-1 font-head text-[13px] text-ink shadow-[2px_3px_0_var(--color-ink)]">
      <span className="flex items-center gap-1.5"><Sw d="M2 5 C 12 1, 22 9, 32 5" stroke="var(--color-teal)" />{TX.legend.blend}</span>
      <span className="flex items-center gap-1.5"><Sw d="M2 5 L 32 5" stroke="var(--color-ink)" w={5} />{TX.legend.carve}</span>
      <span className="flex items-center gap-1.5"><Sw d="M2 5 Q 9 0, 17 5 T 32 5" stroke="var(--color-tangerine)" />{TX.legend.mix}</span>
      <span className="flex items-center gap-1.5 opacity-70"><Sw d="M2 5 L 32 5" stroke="var(--color-ink-2)" w={3} dash="4 4" />{TX.legend.ghost}</span>
    </div>
  );
}

export default function Lineage({ initialOpen = false } = {}) {
  const [open, setOpen] = useState(initialOpen);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const key = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === 'l' || e.key === 'L') toggle();
    };
    window.addEventListener('nonmind:lineage', toggle); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('nonmind:lineage', toggle); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => {
    if (!open) return;
    // capture phase so Esc closes the map without also clearing the board selection
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [open]);
  const btn = 'pointer-events-auto rounded-full border-[3px] border-ink bg-paper px-2.5 font-stat text-[13px] text-ink shadow-[2px_3px_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5';
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="lineage" aria-modal="true" role="dialog" data-modal="lineage" className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[3px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setOpen(false)}>
          <motion.div onClick={(e) => e.stopPropagation()}
            className="relative h-[min(88dvh,900px)] max-h-[calc(100dvh-32px)] w-[min(1180px,100%)] overflow-hidden rounded-[28px] border-4 border-ink bg-paper shadow-[10px_12px_0_var(--color-ink)]"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 35%, var(--color-paper-2) 100%)' }}
            initial={{ y: 26, scale: 0.96, rotate: -0.6 }} animate={{ y: 0, scale: 1, rotate: 0 }} exit={{ y: 18, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <Map2D />
            <div className="pointer-events-none absolute left-6 top-5">
              <div className="font-title text-4xl leading-none text-ink">{TX.title}</div>
              <svg className="mt-1 h-3 w-44" viewBox="0 0 180 12"><path d="M2 7 C 30 1, 50 12, 80 6 S 140 2, 178 7" fill="none" stroke="var(--color-magenta)" strokeWidth="5" strokeLinecap="round" /></svg>
              <div className="mt-1 font-body text-[13px] italic text-ink-2">{TX.sub}</div>
            </div>
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 whitespace-nowrap rounded-full border-[3px] border-ink bg-yolk px-3 py-0.5 font-head text-sm text-ink shadow-[2px_3px_0_var(--color-ink)] hover:rotate-3">close · esc</button>
            <Legend />
            <div className="absolute bottom-[4.75rem] right-4 flex items-center gap-2 sm:bottom-4 sm:right-5">
              <span className="pointer-events-none mr-1 hidden font-stat sm:inline text-[11px] text-ink-2">{TX.hint}</span>
              <button className={btn} onClick={() => current?.zoom(1 / 1.25)}>-</button>
              <button className={btn} onClick={() => current?.zoom(1.25)}>+</button>
              <button className={btn} onClick={() => current?.fit()}>fit</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
