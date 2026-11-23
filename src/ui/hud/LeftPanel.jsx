// Left side: tabbed systems panel (habits, upgrades, insight, verbs, moods, exchange, stance, mirror, attendants, bonds).
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InkButton, Meter, Panel, Tooltip } from '../bits';
import {
  ASPECTS, ASPECT_IDS, ASPECT_THRESHOLDS, HABITS, UPGRADES, SPELLS, VERBS, MOODS, STANCES,
  aspectTiers, aspectsOf, affectMul, habitCost, unlocked, mirrorCost, attendantCost, nameOf, clickValue,
} from '../../game/index.js';
import { act, game, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { fmt, fmtLong, fmtTime } from './fmt.js';
import { Appear, Dot, Label, Scr, POP } from './shared.jsx';

/* ------------------------------------------------------------ rows */

function Row({ children, className, dim }) {
  return (
    <div className={cn('rounded-[12px] border-2 border-ink/80 bg-paper px-2.5 py-2 shadow-[2px_2px_0_0_var(--color-ink)]', dim && 'opacity-60', className)}>
      {children}
    </div>
  );
}
const Cost = ({ v, ok, unit = '' }) => (
  <span className={cn('font-stat text-[13px] leading-none nm-tab', ok ? 'text-ink' : 'text-blood')}>{fmt(v)}{unit}</span>
);

/* ------------------------------------------------------------ habits */

function maxAffordable(G, h) {
  let a = G.affect, n = 0, owned = G.habits[h.id] || 0;
  while (n < 500) { const c = h.base * Math.pow(1.15, owned + n); if (a < c) break; a -= c; n++; }
  return n;
}

function Habits({ G }) {
  const mul = affectMul(G) * (G.upgrades.counting_breaths ? 1 + 0.02 * (G.habits.breath || 0) : 1);
  const visible = HABITS.filter((h, i) => i === 0 || (G.habits[h.id] || 0) > 0 || (G.habits[HABITS[i - 1].id] || 0) > 0 || G.affect >= h.base * 0.4);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[12px] italic text-ink-2">What is done again keeps doing itself. {G.prod > 0 && <span className="font-stat not-italic text-ink">+{fmt(G.prod)}/s</span>}</p>
      <AnimatePresence initial={false}>
        {visible.map((h) => {
          const owned = G.habits[h.id] || 0;
          const cost = habitCost(G, h);
          const ok = G.affect >= cost;
          const max = maxAffordable(G, h);
          return (
            <Appear key={h.id} from="left">
              <Row>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-head text-[16px] leading-none text-ink">{h.name}</span>
                    <span className="mt-1 block font-stat text-[11px] leading-none text-ink-2 nm-tab">+{fmt(h.prod * mul)}/s each</span>
                  </span>
                  <span className="w-[38px] text-right font-stat text-[18px] leading-none text-ink nm-tab">{fmt(owned, { int: true })}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Cost v={cost} ok={ok} />
                  <span className="flex-1" />
                  <InkButton size="sm" tone="yolk" disabled={!ok} onClick={() => act('buyHabit', h.id, 1)} className="[&_.min-h-8]:min-h-6 [&_.text-base]:text-[13px]">+1</InkButton>
                  <InkButton size="sm" tone="tangerine" disabled={max < 2} onClick={() => act('buyHabit', h.id, max)} className="[&_.min-h-8]:min-h-6 [&_.text-base]:text-[13px]">
                    max<span className="ml-1 font-stat text-[11px] normal-case">{max > 1 ? max : ''}</span>
                  </InkButton>
                </div>
              </Row>
            </Appear>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ upgrades */

function Upgrades({ G }) {
  const list = UPGRADES.filter((u) => u.stage <= G.stage && !G.upgrades[u.id]);
  return (
    <div className="flex flex-col gap-2">
      {!list.length && <p className="font-body text-[13px] italic text-ink-2">Nothing more is offered, for now.</p>}
      <AnimatePresence initial={false}>
        {list.map((u) => {
          const ok = G.affect >= u.cost;
          return (
            <Appear key={u.id} from="left">
              <Row>
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-head text-[16px] leading-none text-ink">{u.name}</span>
                    <span className="mt-1 block font-body text-[12px] leading-snug text-ink-2">{u.text}</span>
                  </span>
                  <InkButton size="sm" tone="violet" disabled={!ok} onClick={() => act('buyUpgrade', u.id)} className="mt-0.5 [&_.min-h-8]:min-h-7">
                    <span className="font-stat text-[13px] normal-case">{fmt(u.cost)}</span>
                  </InkButton>
                </div>
              </Row>
            </Appear>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ insight */

function Insight({ G }) {
  return (
    <div className="flex flex-col gap-2">
      <Meter label="insight" value={G.insight / G.insightMax} tone="ultra" format={() => <span className="nm-tab">{Math.floor(G.insight)}/{G.insightMax}</span>} />
      {SPELLS.filter((s) => s.stage <= G.stage).map((s) => {
        const ok = G.insight >= s.cost;
        return (
          <Row key={s.id}>
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block font-head text-[16px] leading-none text-ink">{s.name}</span>
                <span className="mt-1 block font-body text-[12px] leading-snug text-ink-2">{s.text}</span>
              </span>
              <InkButton size="sm" tone="ultra" disabled={!ok} onClick={() => act('cast', s.id)} className="mt-0.5 [&_.min-h-8]:min-h-7">
                <span className="font-stat text-[13px] normal-case">{s.cost}</span>
              </InkButton>
            </div>
          </Row>
        );
      })}
      {G.labelT > 0 && <p className="font-body text-[12px] italic text-magenta">Named. {Math.ceil(G.labelT)}s more.</p>}
    </div>
  );
}

/* ------------------------------------------------------------ verbs + moods */

function Ring({ frac, tone = 'magenta', size = 44, stroke = 5, children, pulse }) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="var(--color-paper-2)" stroke="var(--color-ink)" strokeWidth={stroke + 3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(--color-${tone})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, frac))) }}
          transition={{ duration: 0.14, ease: 'linear' }}
        />
      </svg>
      <motion.span className="relative" animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={pulse ? { duration: 1, repeat: Infinity } : POP}>{children}</motion.span>
    </span>
  );
}

function Verbs({ G }) {
  const sel = G.units.find((u) => u.id === game.selected && !u.busy);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[12px] italic text-ink-2">A verb takes something and gives it back changed, in time. {sel ? <>Holding <b className="not-italic font-head">{nameOf(sel.g)}</b>.</> : 'Choose one to give.'}</p>
      {VERBS.map((v) => {
        const run = G.verbs[v.id];
        const u = run && G.units.find((x) => x.id === run.unit);
        const fits = sel && (!v.needs || sel.traits.includes('fade') || aspectsOf(sel.g).includes(v.needs));
        return (
          <Row key={v.id} className={cn(run && 'border-magenta')}>
            <div className="flex items-center gap-2.5">
              <Ring frac={run ? run.t / v.time : 0} tone={v.needs ? (ASPECTS[v.needs].tone === 'ink' ? 'violet' : ASPECTS[v.needs].tone) : 'sky'} size={46} pulse={run && run.t < 5}>
                <span className="font-stat text-[11px] leading-none text-ink nm-tab">{run ? fmtTime(run.t) : `${v.time}s`}</span>
              </Ring>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-head text-[16px] leading-none text-ink">{v.name}</span>
                  {v.needs && <Tooltip content={`Wants something ${ASPECTS[v.needs].name}.`}><Dot tone={ASPECTS[v.needs].tone} className="h-2.5 w-2.5 border-[1.5px]" /></Tooltip>}
                </span>
                <span className="mt-0.5 block font-body text-[11.5px] leading-snug text-ink-2">{run ? <>with <b className="font-head text-ink">{u ? nameOf(u.g) : 'something'}</b></> : v.text}</span>
              </span>
              {!run && (
                <InkButton size="sm" tone="magenta" disabled={!fits} onClick={() => act('startVerb', v.id, sel.id)} className="[&_.min-h-8]:min-h-7 [&_.text-base]:text-[13px]">give</InkButton>
              )}
            </div>
          </Row>
        );
      })}
    </div>
  );
}

const MOOD_TONE = { dread: 'ink-2', contentment: 'leaf', fascination: 'yolk' };

function Moods({ G }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[12px] italic text-ink-2">Moods arrive and thin out. While here, they lean on everything.</p>
      {!G.moods.length && <p className="font-body text-[13px] italic text-ink-2">The air is empty.</p>}
      <div className="grid grid-cols-2 gap-2">
        <AnimatePresence initial={false}>
          {G.moods.map((m) => {
            const def = MOODS[m.kind];
            return (
              <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.85, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={POP}>
                <Tooltip content={def.text}>
                  <div className="flex w-full flex-col items-center gap-1 rounded-[12px] border-2 border-ink bg-paper px-2 py-2 shadow-[2px_2px_0_0_var(--color-ink)]" style={{ opacity: 0.45 + 0.55 * (m.t / def.life) }}>
                    <Ring frac={m.t / def.life} tone={MOOD_TONE[m.kind] || 'violet'} size={40} stroke={4}>
                      <span className="font-stat text-[10px] text-ink nm-tab">{Math.ceil(m.t)}</span>
                    </Ring>
                    <span className="font-head text-[14px] leading-none">{def.name}</span>
                  </div>
                </Tooltip>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {G.moods.filter((m) => m.kind === 'dread').length >= 3 && <p className="font-body text-[12px] italic text-blood">Three dreads. The gates are wider.</p>}
    </div>
  );
}

/* ------------------------------------------------------------ exchange / stance / mirror / attendants */

function Exchange({ G }) {
  const rates = [
    ['affect', 'attention', Math.max(50, G.prod * 20), 1],
    ['attention', 'insight', 1, 12],
    ['insight', 'attention', 25, 1],
    ['attention', 'affect', 1, Math.max(20, G.prod * 8)],
  ];
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[12px] italic text-ink-2">Each thing here can be paid for with each other thing, badly.</p>
      {rates.map(([from, to, a, b]) => {
        const ok = G[from] >= a;
        return (
          <Row key={from + to}>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-stat text-[13px] leading-none text-ink nm-tab">{fmt(a)} {from} <span className="text-magenta">&gt;</span> {fmt(b)} {to}</span>
              <InkButton size="sm" tone="sky" disabled={!ok} onClick={() => act('exchange', from, to)} className="[&_.min-h-8]:min-h-7 [&_.text-base]:text-[13px]">trade</InkButton>
            </div>
          </Row>
        );
      })}
    </div>
  );
}

function Stance({ G }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[12px] italic text-ink-2">Choose how to stand. It can be changed; it cannot be nothing again.</p>
      {STANCES.map((s) => (
        <Row key={s.id} className={cn(G.stance === s.id && 'border-magenta bg-rose/30')}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block font-head text-[17px] leading-none">{s.name}</span>
              <span className="mt-1 block font-body text-[12px] leading-snug text-ink-2">{s.text}</span>
            </span>
            <InkButton size="sm" tone="magenta" pressed={G.stance === s.id} onClick={() => act('chooseStance', s.id)} className="[&_.min-h-8]:min-h-7 [&_.text-base]:text-[13px]">
              {G.stance === s.id ? 'here' : 'stand'}
            </InkButton>
          </div>
        </Row>
      ))}
    </div>
  );
}

function Mirror({ G }) {
  const cost = mirrorCost(G);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[13px] leading-snug">The whole assembly, reflected into itself. Affect doubles, more may be held, a third ring opens. The weather answers in kind.</p>
      <div className="flex items-center gap-2">
        <span className="font-stat text-[22px] leading-none nm-tab">{G.mirrors}</span><Label>mirrors</Label>
        <span className="flex-1" />
        <Tooltip content={fmtLong(cost) + ' affect'}>
          <InkButton size="sm" tone="ultra" disabled={G.affect < cost} onClick={() => act('mirror')}>
            reflect <span className="ml-1 font-stat text-[12px] normal-case">{fmt(cost)}</span>
          </InkButton>
        </Tooltip>
      </div>
    </div>
  );
}

function Attendants({ G }) {
  const cost = attendantCost(G);
  const each = clickValue(G) * 0.5 * affectMul(G);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[13px] leading-snug">Others attend on your behalf, half as well, without tiring. Each one attends once a second{G.upgrades.lending ? ', twice with Lending' : ''}.</p>
      <div className="flex items-center gap-2">
        <span className="font-stat text-[22px] leading-none nm-tab">{G.attendants}</span><Label>attending</Label>
        <span className="font-stat text-[11px] text-ink-2 nm-tab">~{fmt(each)} each</span>
        <span className="flex-1" />
        <InkButton size="sm" tone="teal" disabled={G.affect < cost} onClick={() => act('buyAttendant')}>
          lend <span className="ml-1 font-stat text-[12px] normal-case">{fmt(cost)}</span>
        </InkButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bonds */

export function Bonds({ G }) {
  const tiers = G.battle?.tiers || aspectTiers(G);
  const rows = ASPECT_IDS.map((a) => ({ a, n: tiers[a + '_n'] || 0, t: tiers[a] || 0 })).filter((r) => r.n > 0).sort((x, y) => y.t - x.t || y.n - x.n);
  return (
    <div className="flex flex-col gap-1.5">
      {!rows.length && <p className="font-body text-[13px] italic text-ink-2">Nothing held shares anything yet. Two of one aspect, seated, begin to agree.</p>}
      {G.battle?.arc?.mod?.noAspects && <p className="font-body text-[12px] italic text-blood">This wave, bonds are silent.</p>}
      <AnimatePresence initial={false}>
        {rows.map(({ a, n, t }) => {
          const A = ASPECTS[a];
          const v = A.v[Math.max(0, t - 1)];
          return (
            <motion.div key={a} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={POP}>
              <div className={cn('rounded-[10px] border-2 px-2 py-1.5', t ? 'border-ink bg-paper shadow-[2px_2px_0_0_var(--color-ink)]' : 'border-ink/30 bg-paper/70')}>
                <div className="flex items-center gap-1.5">
                  <Dot tone={A.tone} className="h-3 w-3" />
                  <span className="font-head text-[15px] leading-none">{A.name}</span>
                  <span className="font-stat text-[13px] leading-none text-ink-2 nm-tab">{n}</span>
                  <span className="ml-auto flex gap-1">
                    {ASPECT_THRESHOLDS.map((th, i) => (
                      <span key={th} className={cn('grid h-[18px] w-[18px] place-items-center rounded-[5px] border-2 border-ink font-stat text-[10px] leading-none', i < t ? 'text-ink' : 'bg-paper text-ink-2')} style={i < t ? { background: `var(--color-${A.tone === 'ink' ? 'violet' : A.tone})` } : undefined}>{th}</span>
                    ))}
                  </span>
                </div>
                <p className={cn('mt-1 font-body text-[11.5px] leading-snug', t ? 'text-ink' : 'text-ink-2/70')}>{A.text.replace('%v', String(v))}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ tabs */

const TABS = [
  { id: 'bonds', label: 'bonds', tone: 'rose', show: (G) => unlocked(G, 'shop'), C: Bonds },
  { id: 'habits', label: 'habits', tone: 'yolk', show: (G) => unlocked(G, 'habits'), C: Habits },
  { id: 'upgrades', label: 'ways', tone: 'violet', show: (G) => unlocked(G, 'habits'), C: Upgrades, badge: (G) => UPGRADES.filter((u) => u.stage <= G.stage && !G.upgrades[u.id] && G.affect >= u.cost).length },
  { id: 'insight', label: 'insight', tone: 'ultra', show: (G) => unlocked(G, 'insight'), C: Insight },
  { id: 'verbs', label: 'verbs', tone: 'magenta', show: (G) => unlocked(G, 'verbs'), C: Verbs, badge: (G) => Object.values(G.verbs).filter(Boolean).length },
  { id: 'moods', label: 'moods', tone: 'ink-2', show: (G) => G.moods.length > 0 || unlocked(G, 'verbs'), C: Moods, badge: (G) => G.moods.length },
  { id: 'exchange', label: 'trade', tone: 'sky', show: (G) => unlocked(G, 'exchange'), C: Exchange },
  { id: 'stance', label: 'stance', tone: 'tangerine', show: (G) => unlocked(G, 'stance'), C: Stance },
  { id: 'mirror', label: 'mirror', tone: 'ultra', show: (G) => unlocked(G, 'mirror'), C: Mirror },
  { id: 'attendants', label: 'others', tone: 'teal', show: (G) => unlocked(G, 'attendants'), C: Attendants },
];

export default function LeftPanel({ compact }) {
  const G = useGame();
  const tabs = TABS.filter((t) => t.show(G));
  const [tab, setTab] = useState('habits');
  const cur = tabs.find((t) => t.id === tab) || tabs.find((t) => t.id === 'habits') || tabs[0];
  // a newly unlocked tab draws the eye once
  const [fresh, setFresh] = useState(null);
  const ids = tabs.map((t) => t.id).join(',');
  const [seen, setSeen] = useState(ids);
  useEffect(() => {
    if (ids === seen) return;
    const added = ids.split(',').find((x) => !seen.split(',').includes(x));
    setSeen(ids);
    if (added) { setFresh(added); const t = setTimeout(() => setFresh(null), 2400); return () => clearTimeout(t); }
    return undefined;
  }, [ids, seen]);
  if (!cur) return null;
  const Body = cur.C;
  return (
    <Appear from="left" className={cn('pointer-events-auto', compact ? 'w-[280px]' : 'w-[316px]')}>
      <Panel title={<Scr k={50}>{cur.label}</Scr>} tone={cur.tone === 'ink-2' ? 'violet' : cur.tone} bodyClassName="px-3 pt-2 pb-3">
        <div className={cn('mb-2 flex flex-wrap gap-1', tabs.length < 2 && 'hidden')}>
          <AnimatePresence initial={false}>
            {tabs.map((t) => {
              const b = t.badge?.(G) || 0;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: fresh === t.id ? [1, 1.18, 1] : 1 }}
                  transition={fresh === t.id ? { duration: 0.5, repeat: 3 } : POP}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative rounded-[8px] border-2 border-ink px-2 py-[3px] font-head text-[13px] leading-none tracking-wide uppercase shadow-[1px_2px_0_0_var(--color-ink)] transition-colors',
                    t.id === cur.id ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-2',
                  )}
                >
                  <Scr k={t.id.length}>{t.label}</Scr>
                  {b > 0 && <span className="absolute -top-2 -right-2 grid h-4 min-w-4 place-items-center rounded-full border-2 border-ink bg-yolk px-0.5 font-stat text-[9px] leading-none text-ink">{b}</span>}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <div className="nm-scroll -mr-1.5 overflow-y-auto pr-1.5 pb-1" style={{ maxHeight: 'calc(var(--band-h) - var(--log-h) - 100px)' }}>
          <motion.div key={cur.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
            <Body G={G} />
          </motion.div>
        </div>
      </Panel>
    </Appear>
  );
}
