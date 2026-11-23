// NON-MIND HUD: DOM overlay over the full-screen WebGL arena. The centre stays clear.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InkButton } from './bits';
import { unlocked } from '../game/index.js';
import { act, game, select, setPending, useGame } from '../game/store.js';
import { cn } from '../lib/cn';
import TopBar from './hud/TopBar.jsx';
import Bottom from './hud/Bottom.jsx';
import Inspector from './hud/Inspector.jsx';
import LeftPanel from './hud/LeftPanel.jsx';
import Reset from './hud/Reset.jsx';
import Codex from './hud/Codex.jsx';
import Title from './hud/Title.jsx';
import { Log, StageFlash } from './hud/Log.jsx';
import { attend } from './hud/bus.js';
import { DegradeCtx, HUD_CSS, Key, POP, Scr, Shake } from './hud/shared.jsx';

function useViewport() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(get);
  useEffect(() => {
    const on = () => setV(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

// callback ref + observed height (the observed node mounts only after the title is gone)
function useHeight() {
  const [el, setEl] = useState(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    if (!el) return undefined;
    setH(Math.round(el.getBoundingClientRect().height));
    const ro = new ResizeObserver(([e]) => setH(Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, h];
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function PendingBanner() {
  const G = useGame();
  const p = game.pending;
  const a = p && G.units.find((u) => u.id === p.a);
  return (
    <AnimatePresence>
      {p && a && (
        <motion.div
          key="pending"
          className="pointer-events-auto flex items-center gap-3 rounded-[14px] border-[3px] border-ink bg-paper px-3 py-2 shadow-[3px_4px_0_0_var(--color-ink)]"
          initial={{ opacity: 0, y: -12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
          transition={POP}
        >
          <span className={cn('h-3 w-3 rounded-full border-2 border-ink', p.kind === 'integrate' ? 'bg-teal' : 'bg-blood')} />
          <span className="font-head text-[16px] leading-none uppercase">{p.kind}</span>
          <span className="font-body text-[14px] italic text-ink-2">choose a second one</span>
          <InkButton size="sm" tone="paper" onClick={() => setPending(null)}>cancel</InkButton>
          <Key k="esc" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Hud() {
  const G = useGame();
  const { w, h } = useViewport();
  const compact = w < 1320 || h < 820;
  const [codex, setCodex] = useState(false);
  const [topRef, topH] = useHeight();
  const [botRef, botH] = useHeight();
  const started = game.started;

  // overwhelm degradation: 0 below a quarter, full at 1
  const d = started ? smooth(0.25, 1, G.overwhelm) : 0;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (d < 0.05) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), 130);
    return () => clearInterval(t);
  }, [d >= 0.05]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (!game.started || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const G = game.G;
      const k = e.key.toLowerCase();
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) attend();
        return;
      }
      if (e.repeat) return;
      if (k === 'escape') {
        if (codexRef.current) setCodex(false);
        else if (game.pending) setPending(null);
        else if (game.selected != null) select(game.selected);
        return;
      }
      if (k === 'c') { setCodex((c) => !c); return; }
      if (!unlocked(G, 'shop')) return;
      if (k === 'r') act('reroll');
      else if (k === 'x') act('buyXp');
      else if (/^[1-5]$/.test(k)) act('buy', Number(k) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const codexRef = useRef(codex);
  codexRef.current = codex;

  const bandTop = topH + 24;
  const bandBottom = botH + 24;
  const bandH = Math.max(160, h - bandTop - bandBottom);
  const logH = compact ? 50 : 104;

  return (
    <DegradeCtx.Provider value={{ d, tick }}>
      <style>{HUD_CSS}</style>
      <div
        className="pointer-events-none fixed inset-0 z-10 overflow-hidden font-body text-ink select-none"
        style={{ '--band-h': `${bandH}px`, '--log-h': `${logH}px` }}
      >
        {started && (
          <>
            <div ref={topRef} className="absolute inset-x-3 top-3"><TopBar compact={compact} /></div>
            <div ref={botRef} className="absolute inset-x-3 bottom-3"><Bottom compact={compact} /></div>

            <div className="absolute left-3 flex flex-col justify-between gap-3" style={{ top: bandTop, bottom: bandBottom }}>
              <Shake seed={31}><LeftPanel compact={compact} /></Shake>
              <Log compact={compact} />
            </div>

            <div className="absolute right-3 flex flex-col items-end gap-3" style={{ top: bandTop, bottom: bandBottom }}>
              <div className="pointer-events-auto flex items-start gap-3">
                <Shake seed={41}>
                  <InkButton size="sm" tone="paper" hotkey="c" onClick={() => setCodex(true)}><Scr k={60}>codex</Scr></InkButton>
                </Shake>
                <AnimatePresence>
                  {G.stage >= 1 && (
                    <motion.div key="reset" initial={{ opacity: 0, scale: 0.8, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={POP}>
                      <Shake seed={42}><Reset /></Shake>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Shake seed={43}><Inspector compact={compact} /></Shake>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: bandTop }}><PendingBanner /></div>
            <StageFlash />

            {/* overwhelm: the edges flush and close in */}
            {d > 0.02 && (
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ boxShadow: `inset 0 0 ${60 + 140 * d}px ${20 * d}px color-mix(in srgb, var(--color-magenta) ${Math.round(45 * d)}%, transparent)` }}
                animate={G.overwhelm >= 1 ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
                transition={G.overwhelm >= 1 ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
              />
            )}
          </>
        )}
        <AnimatePresence>{codex && started && <Codex key="codex" onClose={() => setCodex(false)} />}</AnimatePresence>
        <AnimatePresence>{!started && <Title key="title" />}</AnimatePresence>
      </div>
    </DegradeCtx.Provider>
  );
}
