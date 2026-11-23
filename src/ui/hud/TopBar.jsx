// Top bar: stage tracker, resources, complexity/composure, wave banner.
import { AnimatePresence, motion } from 'motion/react';
import { Cryptic, Meter, StatChip, Tooltip } from '../bits';
import { STAGES, WAVE_ARC, BEATS_PER_WAVE, unlocked } from '../../game/index.js';
import { useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { fmt, fmtLong } from './fmt.js';
import { Appear, Scr, Shake, POP } from './shared.jsx';

export const STAGE_NAME = (i) => STAGES[i].id;

function StageTracker({ G, compact }) {
  const next = STAGES[G.stage + 1];
  return (
    <div className={cn('rounded-[16px] border-[3px] border-ink bg-paper/95 px-3 py-2 shadow-[3px_4px_0_0_var(--color-ink)]', compact ? 'w-[232px]' : 'w-[290px]')}>
      <div className="flex items-center gap-[3px]" aria-label={`stage ${G.stage + 1} of 18`}>
        {STAGES.map((s, i) => (
          <Tooltip key={i} side="bottom" content={i <= G.stage ? <span><b className="font-head">{s.id}</b>: {s.hint}</span> : 'Not yet.'}>
            <motion.span
              className={cn('block h-[10px] rounded-[3px] border-2 border-ink', i === G.stage ? 'w-[14px]' : compact ? 'w-[8px]' : 'w-[11px]')}
              initial={false}
              animate={{ backgroundColor: i < G.stage ? 'var(--color-ink)' : i === G.stage ? 'var(--color-magenta)' : 'var(--color-paper)', scale: i === G.stage ? 1.12 : 1 }}
              transition={POP}
            />
          </Tooltip>
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-stat text-[13px] text-ink-2 nm-tab">{G.stage + 1}/18</span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={G.stage}
            className={cn('font-head leading-none text-ink uppercase', compact ? 'text-[26px]' : 'text-[30px]')}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={POP}
          >
            <Scr k={1}>{STAGE_NAME(G.stage)}</Scr>
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-0.5 h-[18px] truncate text-[13px] leading-[18px]">
        {next ? <Cryptic key={G.stage} text={next.hint} tone="magenta" /> : <span className="font-body text-ink-2 italic">There is no next. There is this.</span>}
      </div>
    </div>
  );
}

function Resources({ G, compact }) {
  const w = compact ? 'w-[94px]' : 'w-[108px]';
  const chips = [
    { k: 'affect', show: true, tone: 'magenta', value: fmt(G.affect), hint: <span><b className="font-head">Affect</b> {fmtLong(G.affect)}. Gathered by attending, by habits, by what falls. {G.prod > 0 && <>Now {fmtLong(G.prod)} each second.</>}</span>, sub: G.prod > 0 ? `+${fmt(G.prod)}/s` : '' },
    { k: 'attention', show: unlocked(G, 'shop'), tone: 'yolk', value: fmt(G.attention, { int: true }), hint: 'Attention. Spent to bring things in, to look again, to grow. Paid out when a wave is held; idle attention earns a little more.' },
    { k: 'insight', show: unlocked(G, 'insight'), tone: 'ultra', value: `${Math.floor(G.insight)}`, hint: `Insight ${Math.floor(G.insight)} of ${G.insightMax}. It seeps in on its own and is spent on joining, cutting and spells.` },
    { k: 'mu', show: G.mu > 0 || G.depth > 0, tone: 'violet', value: fmt(G.mu, { int: true }), hint: `Mu ${fmtLong(G.mu)}. What remains after letting go. It widens affect, and every beginning starts with a little more attention.` },
    { k: 'endings', show: G.endings > 0, tone: 'leaf', value: fmt(G.endings, { int: true }), hint: 'Endings. Things that reached the twelfth link and stopped. Each one raises affect and salience for good.' },
  ];
  return (
    <div className={cn('flex flex-wrap content-start gap-2', compact ? 'max-w-[350px]' : 'max-w-[400px]')}>
      <AnimatePresence initial={false}>
        {chips.filter((c) => c.show).map((c) => (
          <Appear key={c.k} from="down" className="relative">
            <StatChip
              label={<Scr k={c.k.length}>{c.k}</Scr>}
              value={<span className="nm-tab">{c.value}{c.sub && <span className="ml-1.5 text-[12px] text-ink-2">{c.sub}</span>}</span>}
              tone={c.tone}
              hint={c.hint}
              className={c.sub !== undefined ? (compact ? 'w-[150px]' : 'w-[170px]') : w}
            />
          </Appear>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Gauges({ G, compact }) {
  const ratio = G.complexity / Math.max(1, G.capacity);
  return (
    <div className={cn('flex flex-col gap-2 rounded-[16px] border-[3px] border-ink bg-paper/95 px-3 py-2 shadow-[3px_4px_0_0_var(--color-ink)]', compact ? 'w-[178px]' : 'w-[214px]')}>
      <Tooltip side="bottom" content="Complexity against capacity. Every part, link, habit and mood adds to it. Past capacity it begins to be too much, and too much is a door.">
        <Meter
          className="w-full"
          label={<Scr k={3}>complexity</Scr>}
          value={Math.min(1, ratio)}
          danger={G.overwhelm > 0}
          tone="violet"
          format={() => <span className="nm-tab">{fmt(G.complexity, { int: true })}/{fmt(G.capacity, { int: true })}</span>}
        />
      </Tooltip>
      <Tooltip side="bottom" content="Composure. What reaches the centre takes it away. When it is gone, the wave is lost.">
        <Meter className="w-full" label={<Scr k={4}>composure</Scr>} value={G.composure / G.composureMax} tone="teal" danger={G.composure / G.composureMax < 0.25} />
      </Tooltip>
    </div>
  );
}

const PHASE = { prep: 'gathering', fight: 'holding', won: 'held', lost: 'broken' };

function WaveBanner({ G, compact }) {
  const arc = G.battle?.arc || WAVE_ARC[(G.wave - 1) % 10];
  const beat = G.phase === 'fight' ? G.battle?.beat ?? 0 : G.phase === 'prep' ? 0 : BEATS_PER_WAVE;
  return (
    <div className={cn('rounded-[16px] border-[3px] border-ink bg-paper/95 px-3 py-2 shadow-[3px_4px_0_0_var(--color-ink)]', compact ? 'w-[214px]' : 'w-[250px]')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-stat text-lg leading-none text-ink nm-tab">wave {G.cycle}.{G.wave}</span>
        <span className={cn('rounded-[6px] border-2 border-ink px-1.5 py-[1px] font-head text-[11px] leading-none tracking-wider uppercase',
          G.phase === 'fight' ? 'bg-magenta text-paper' : G.phase === 'won' ? 'bg-leaf text-ink' : G.phase === 'lost' ? 'bg-blood text-paper' : 'bg-paper-2 text-ink')}>
          <Scr k={5}>{PHASE[G.phase] || G.phase}</Scr>
        </span>
      </div>
      <Tooltip side="bottom" content={arc.text}>
        <div className="mt-1 w-full">
          <div className="truncate font-head text-[15px] leading-tight text-ink" title={arc.name}><Scr k={6}>{arc.name}</Scr></div>
          <div className="truncate font-body text-[12px] italic leading-tight text-ink-2">{arc.text}</div>
        </div>
      </Tooltip>
      <div className="mt-1.5 flex gap-[4px]">
        {Array.from({ length: BEATS_PER_WAVE }, (_, i) => (
          <motion.span
            key={i}
            className="block h-[9px] flex-1 rounded-full border-2 border-ink"
            initial={false}
            animate={{ backgroundColor: i < beat ? 'var(--color-ink)' : i === beat && G.phase === 'fight' ? 'var(--color-yolk)' : 'var(--color-paper)', scaleY: i === beat - 1 && G.phase === 'fight' ? [1.6, 1] : 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          />
        ))}
      </div>
    </div>
  );
}

export default function TopBar({ compact }) {
  const G = useGame();
  const fighting = unlocked(G, 'shop');
  return (
    <div className="pointer-events-none flex items-start gap-3">
      <Shake seed={11} className="pointer-events-auto"><StageTracker G={G} compact={compact} /></Shake>
      <Shake seed={12} className="pointer-events-auto"><Resources G={G} compact={compact} /></Shake>
      <div className="flex-1" />
      <AnimatePresence initial={false}>
        {fighting && (
          <Appear key="g" from="down" className="pointer-events-auto"><Shake seed={13}><Gauges G={G} compact={compact} /></Shake></Appear>
        )}
        {fighting && (
          <Appear key="w" from="down" delay={0.05} className="pointer-events-auto"><Shake seed={14}><WaveBanner G={G} compact={compact} /></Shake></Appear>
        )}
      </AnimatePresence>
    </div>
  );
}
