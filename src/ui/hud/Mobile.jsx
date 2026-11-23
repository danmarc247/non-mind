// Phone / tablet HUD: a slim top strip, the arena in the middle, and a bottom dock of tab pills that
// opens a bottom sheet. ATTEND sits in the dock under the right thumb. Touch only: no hotkeys, no hover.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Meter, Panel, toneVar } from '../bits';
import { STAGES, unlocked, WAVE_ARC, BEATS_PER_WAVE } from '../../game/index.js';
import { game, select, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { onHud } from './bus.js';
import { fmt } from './fmt.js';
import { Resources } from './TopBar.jsx';
import { AttendButton, Bench, Shop } from './Bottom.jsx';
import { TABS } from './LeftPanel.jsx';
import { Body as InspectorBody } from './Inspector.jsx';
import Reset from './Reset.jsx';
import Tools from './Tools.jsx';
import Ask from './Ask.jsx';
import { Herald, Log } from './Log.jsx';
import { POP, Scr, Shake } from './shared.jsx';

const PHASE = { prep: 'gathering', fight: 'holding', won: 'held', lost: 'broken' };
const NO_PINCH = '[touch-action:pan-x_pan-y]';

function StageWave({ G }) {
  const arc = G.battle?.arc || WAVE_ARC[(G.wave - 1) % 10];
  const beat = G.phase === 'fight' ? G.battle?.beat ?? 0 : G.phase === 'prep' ? 0 : BEATS_PER_WAVE;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[16px] border-[3px] border-ink bg-paper/95 px-2.5 py-1.5 shadow-[3px_4px_0_0_var(--color-ink)]" data-tut="wave">
      <div className="flex items-baseline gap-2">
        <span className="font-stat text-[12px] text-ink-2 nm-tab">{G.stage + 1}/18</span>
        <span className="truncate font-head text-[19px] leading-none uppercase" data-tut="stage"><Scr k={1}>{STAGE(G)}</Scr></span>
        {unlocked(G, 'shop') && <span className="ml-auto shrink-0 font-stat text-[13px] nm-tab">wave {G.cycle + 1}.{G.wave}</span>}
      </div>
      {unlocked(G, 'shop') && (
        <>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-body text-[12px] italic text-ink-2">{arc.name}: {arc.text}</span>
            <span className={cn('shrink-0 rounded-[6px] border-2 border-ink px-1 font-head text-[12px] leading-tight uppercase', G.phase === 'fight' ? 'bg-magenta text-paper' : 'bg-paper-2')}>{PHASE[G.phase]}</span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: BEATS_PER_WAVE }, (_, i) => (
              <span key={i} className={cn('block h-[7px] flex-1 rounded-full border-[1.5px] border-ink', i < beat ? 'bg-ink' : i === beat && G.phase === 'fight' ? 'bg-yolk' : 'bg-paper')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
const STAGE = (G) => STAGES[G.stage].id;

function Gauges({ G }) {
  return (
    <div className="flex gap-2 rounded-[16px] border-[3px] border-ink bg-paper/95 px-2.5 py-1.5 shadow-[3px_4px_0_0_var(--color-ink)]" data-tut="complexity">
      <Meter className="min-w-0 flex-1" label="complexity" value={Math.min(1, G.complexity / Math.max(1, G.capacity))} danger={G.overwhelm > 0} tone="violet"
        format={() => <span className="nm-tab">{fmt(G.complexity, { int: true })}/{fmt(G.capacity, { int: true })}</span>} />
      <Meter className="min-w-0 flex-1" label="composure" value={G.composure / G.composureMax} tone="teal" danger={G.composure / G.composureMax < 0.25} />
    </div>
  );
}

/** Pill row entries: arrivals, waiting, every unlocked side tab, and the inspector while something is chosen. */
function pills(G) {
  const out = [];
  if (unlocked(G, 'shop')) out.push({ id: 'shop', label: 'arrivals', tone: 'yolk' }, { id: 'bench', label: 'waiting', tone: 'teal' });
  for (const t of TABS) if (t.show(G)) out.push({ id: t.id, label: t.label, tone: t.tone === 'ink-2' ? 'violet' : t.tone, tab: t });
  if (G.units.some((u) => u.id === game.selected)) out.unshift({ id: 'regard', label: 'regard', tone: 'magenta' });
  return out;
}

export default function Mobile({ w, h }) {
  const G = useGame();
  const portrait = h >= w;
  const [open, setOpen] = useState(null);
  const list = pills(G);
  const cur = list.find((p) => p.id === open) || null;
  const selId = G.units.some((u) => u.id === game.selected) ? game.selected : null;

  // choosing a unit (in 3D or in a sheet) opens its page; the tutorial may open a sheet too
  useEffect(() => { if (selId != null) setOpen('regard'); else setOpen((o) => (o === 'regard' ? null : o)); }, [selId]);
  useEffect(() => onHud((e) => { if (e.type === 'tab' || e.type === 'sheet') setOpen(e.id); }), []);
  // arrivals open by themselves the first time they exist
  const shopOn = unlocked(G, 'shop');
  useEffect(() => { if (shopOn) setOpen((o) => o ?? 'shop'); }, [shopOn]);

  const top = 'calc(env(safe-area-inset-top, 0px) + 8px)';
  const attendSize = portrait ? (w >= 700 ? 112 : 92) : 76;
  // everything under the top strip hangs from its measured bottom edge
  const stripRef = useRef(null);
  const [stripB, setStripB] = useState(150);
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    const upd = () => { const b = Math.round(el.getBoundingClientRect().bottom); setStripB((o) => (o === b ? o : b)); };
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [h, w]);
  const rail = stripB + 8; // first y under the strip
  const SAFE_B = 'env(safe-area-inset-bottom, 0px)';
  const DOCK_H = 58;
  // portrait: the sheet floats above ATTEND as well as the dock; landscape: it takes the left side, under the chips
  const sheetBottom = portrait ? 8 + attendSize + 6 : 8 + DOCK_H + 6;
  const sheetMax = portrait ? `${Math.round(h * 0.4)}px` : `calc(${Math.max(120, h - sheetBottom - rail)}px - ${SAFE_B})`;

  const sheetBody = () => {
    if (!cur) return null;
    if (cur.id === 'shop') return <Shop G={G} compact mobile />;
    if (cur.id === 'bench') return <Bench G={G} compact />;
    if (cur.id === 'regard') {
      const u = G.units.find((x) => x.id === selId);
      return u ? (
        <Panel bodyClassName="px-4 pt-3 pb-4">
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => select(u.id)} className="min-h-11 rounded-[10px] border-2 border-ink bg-paper px-3 font-head text-[14px] uppercase shadow-[1px_2px_0_0_var(--color-ink)]">close</button>
          </div>
          <InspectorBody G={G} u={u} />
        </Panel>
      ) : null;
    }
    const C = cur.tab.C;
    return <Panel bodyClassName="px-3 pt-3 pb-3"><C G={G} /></Panel>;
  };

  return (
    <div className="pointer-events-none absolute inset-0" style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
      {/* top strip */}
      <div ref={stripRef} className={cn('pointer-events-none absolute inset-x-2 flex flex-col gap-2', NO_PINCH)} style={{ top }}>
        <div className="flex items-start gap-2">
          <Shake seed={11} className="pointer-events-auto min-w-0 flex-1"><StageWave G={G} /></Shake>
          <div className="pointer-events-auto flex shrink-0 items-start gap-1.5">
            {G.stage >= 1 && <Reset compact small />}
          </div>
        </div>
        <Shake seed={12} className="pointer-events-auto nm-scroll -mx-1 overflow-x-auto px-1 pb-1 [touch-action:pan-x]">
          <div className="w-max"><Resources G={G} compact mobile /></div>
        </Shake>
        {portrait && unlocked(G, 'shop') && <Shake seed={13} className="pointer-events-auto"><Gauges G={G} /></Shake>}
      </div>

      {/* ask for a hint: always there, on the right edge */}
      {/* ask + tool rings (codex, manual, save, lineage...) hang under the strip on the right edge, 6px apart */}
      <div className={cn('pointer-events-none absolute right-2 flex gap-1.5', portrait ? 'flex-col items-end' : 'items-start')} style={{ top: rail }}>
        <div className="pointer-events-auto"><Ask size={46} /></div>
        {!cur && (
          <div className="pointer-events-auto">
            <Tools size={52} layout={portrait ? 'col' : 'grid'} className={portrait ? undefined : 'grid-cols-3'} hotkeys={false} />
          </div>
        )}
      </div>

      {/* a new line arrives large in the clear middle, then settles into the log; never over the rings */}
      <div className="pointer-events-none absolute left-2" style={{ top: portrait ? rail + 52 : rail, right: portrait ? 68 : 236 }}>
        <Herald size={portrait ? 22 : 20} />
      </div>

      {/* log, quietly, above the dock and clear of ATTEND */}
      <div className="pointer-events-none absolute left-2" style={{ bottom: `calc(${SAFE_B} + ${8 + DOCK_H + 8}px)`, width: `min(300px, calc(100% - ${attendSize + 22}px))`, display: cur ? 'none' : undefined }}>
        <div className="[&>div]:w-full"><Log compact mobile /></div>
      </div>

      {/* bottom sheet */}
      <AnimatePresence>
        {cur && (
          <motion.div
            key="sheet"
            className={cn('pointer-events-auto absolute overflow-hidden', portrait ? 'inset-x-2' : 'left-2', NO_PINCH)}
            style={{ bottom: `calc(${SAFE_B} + ${sheetBottom}px)`, maxHeight: sheetMax, width: portrait ? undefined : 'min(46%, 400px)' }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={POP}
            data-tut={cur.id === 'shop' ? 'shop' : cur.id === 'bench' ? 'bench' : undefined}
          >
            <div className="nm-scroll overflow-y-auto overscroll-contain pb-1 [touch-action:pan-y]" style={{ maxHeight: sheetMax }}>
              <motion.div key={cur.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                {sheetBody()}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* dock: pills + ATTEND */}
      <div className={cn('pointer-events-none absolute inset-x-2 flex items-end gap-2', NO_PINCH)} style={{ bottom: `calc(${SAFE_B} + 8px)` }}>
        <div className="pointer-events-auto nm-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto rounded-[16px] border-[3px] border-ink bg-paper/95 p-1 shadow-[3px_4px_0_0_var(--color-ink)] [touch-action:pan-x]">
          {!list.length && <span className="flex h-11 items-center px-2 font-body text-[13px] italic text-ink-2">Nothing else yet.</span>}
          {list.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              layout
              data-tut={p.tab ? `tab-${p.id}` : `pill-${p.id}`}
              onClick={() => setOpen((o) => (o === p.id ? null : p.id))}
              whileTap={{ scaleX: 1.08, scaleY: 0.88, transition: { duration: 0.1 } }}
              transition={POP}
              className={cn('relative flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] border-2 px-3 font-head text-[15px] leading-none tracking-wide uppercase',
                open === p.id ? 'border-ink bg-ink text-paper' : 'border-transparent text-ink')}
            >
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink" style={{ background: toneVar(p.tone) }} />
              {p.label}
            </motion.button>
          ))}
        </div>
        <div className="pointer-events-auto -mr-3 shrink-0">
          <AttendButton G={G} compact size={attendSize} touch />
        </div>
      </div>
    </div>
  );
}

