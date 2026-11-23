// Right-side inspector for game.selected.
import { AnimatePresence, motion } from 'motion/react';
import { InkButton, Panel, Tooltip, toneHex } from '../bits';
import {
  ASPECTS, ABILITIES, FAMILY, HABITS, LINKS, TRAITS, VERBS, COSTS,
  aspectsOf, aspectTiers, abilityOf, echoAbilityOf, leafCount, nameOf, tierOf, unitStats, unlocked, unitCap, ringsOpen,
} from '../../game/index.js';
import { act, game, select, setPending, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { fmt } from './fmt.js';
import { STAT_TEXT } from './text.js';
import { Appear, Dot, Label, Scr, POP } from './shared.jsx';
import { FAMILY_PALETTES } from '../../gfx/palettes/families.js';

// Oblique, but each line says what the number does.
export const STAT_LINES = [
  { k: 'tol', name: 'Tolerance', v: (s) => fmt(s.tol), line: STAT_TEXT.tol },
  { k: 'sal', name: 'Salience', v: (s) => fmt(s.sal), line: STAT_TEXT.sal },
  { k: 'lat', name: 'Latency', v: (s) => `${s.lat.toFixed(2)}s`, line: STAT_TEXT.lat },
  { k: 'reach', name: 'Reach', v: (s) => s.reach.toFixed(1), line: STAT_TEXT.reach },
  { k: 'opa', name: 'Opacity', v: (s) => `${Math.round(s.opa)}%`, line: STAT_TEXT.opa },
  { k: 'lab', name: 'Lability', v: (s) => `±${Math.round(s.lab * 100)}%`, line: STAT_TEXT.lab },
  { k: 'rec', name: 'Recursion', v: (s) => `${Math.round(s.rec)}%`, line: STAT_TEXT.rec },
];

const OP = { blend: '+', carve: '−', mix: '~' };
const firstFamily = (g) => { while (g.t === 'node') g = g.a; return g.f; };

function Gene({ g, depth = 0 }) {
  if (g.t === 'leaf') {
    const f = FAMILY[g.f];
    const p = FAMILY_PALETTES[g.f];
    const dark = ['ink', 'ultra', 'violet', 'blood'].map((t) => toneHex(t)).includes(p.a);
    return (
      <Tooltip content={`${g.pole > 0 ? 'Idealized ' : g.pole < 0 ? 'Devalued ' : ''}${f.name}`}>
        <span
          className="inline-flex h-[20px] items-center rounded-[6px] border-2 border-ink px-1 font-stat text-[11px] leading-none"
          style={{ background: p.a, color: dark ? 'var(--color-paper)' : 'var(--color-ink)' }}
        >
          {f.id.slice(0, 3)}{g.pole > 0 ? '+' : g.pole < 0 ? '-' : ''}
        </span>
      </Tooltip>
    );
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-[3px] rounded-[8px] border-2 px-[3px] py-[2px]', depth % 2 ? 'border-ink/40 bg-paper' : 'border-ink/60 bg-paper-2')}>
      <span className="font-head text-[13px] leading-none text-ink-2">[</span>
      <Gene g={g.a} depth={depth + 1} />
      <span className={cn('font-head text-[14px] leading-none', g.op === 'carve' ? 'text-blood' : 'text-teal')}>{OP[g.op] || '?'}</span>
      <Gene g={g.b} depth={depth + 1} />
      <span className="font-head text-[13px] leading-none text-ink-2">]</span>
    </span>
  );
}

function Section({ label, children, className }) {
  return (
    <div className={cn('mt-3', className)}>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function firstFreeSeat(G) {
  const taken = new Set(G.units.filter((o) => o.seat).map((o) => o.seat.ring * 10 + o.seat.dir));
  for (let s = 0; s < ringsOpen(G) * 10; s++) if (!taken.has(s)) return { ring: Math.floor(s / 10), dir: s % 10 };
  return null;
}

function Ops({ G, u }) {
  const ins = unlocked(G, 'insight');
  const busy = !!u.busy;
  const canSplit = u.g.t === 'node' || (u.g.pole === 0 && u.link > 1);
  const sellVal = Math.max(1, Math.round(tierOf(u.g) * u.link * 0.75 * Math.sqrt(leafCount(u.g))));
  const habit = HABITS[Math.min(HABITS.length - 1, FAMILY[firstFamily(u.g)].dir)];
  const repN = Math.round(tierOf(u.g) * u.link * (1 + leafCount(u.g)));
  const pending = game.pending;
  const seatedN = G.units.filter((o) => o.seat).length;
  const gone = (fn) => () => { fn(); if (!G.units.some((o) => o.id === u.id)) select(u.id); };

  const btn = (key, show, label, tone, onClick, { disabled = false, tip, cost } = {}) =>
    show && (
      <Appear key={key} from="up" className="inline-flex">
        <Tooltip content={tip}>
          <InkButton size="sm" tone={tone} disabled={disabled || busy} pressed={pending?.kind === key} onClick={onClick}>
            {label}{cost != null && <span className="ml-1 font-stat text-[12px] normal-case">{cost}</span>}
          </InkButton>
        </Tooltip>
      </Appear>
    );

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {btn('integrate', unlocked(G, 'integrate'), 'integrate', 'teal', () => setPending(pending?.kind === 'integrate' ? null : 'integrate'), {
          disabled: ins && G.insight < COSTS.integrate,
          cost: ins ? COSTS.integrate : null,
          tip: 'Join this with another. The two become one shape that remembers both.',
        })}
        {btn('subtract', unlocked(G, 'subtract'), 'subtract', 'blood', () => setPending(pending?.kind === 'subtract' ? null : 'subtract'), {
          disabled: ins && G.insight < COSTS.subtract,
          cost: ins ? COSTS.subtract : null,
          tip: 'Carve another out of this. This one keeps its rung and takes one trait from the other.',
        })}
        {btn('split', unlocked(G, 'split'), 'split', 'violet', gone(() => act('split', u.id)), {
          disabled: !canSplit || G.insight < COSTS.split,
          cost: COSTS.split,
          tip: canSplit ? 'Open the seam. What was joined becomes two again.' : 'It has no seam.',
        })}
        {btn('repurpose', unlocked(G, 'repurpose'), 'repurpose', 'tangerine', gone(() => act('repurpose', u.id)), {
          tip: `It stops being a thing and becomes ${repN} of ${habit.name}.`,
        })}
        {btn('seat', !u.seat, 'seat', 'yolk', () => { const s = firstFreeSeat(G); if (s) act('place', u.id, s); }, {
          disabled: seatedN >= unitCap(G) || !firstFreeSeat(G),
          tip: 'Give it the first open place in the circle.',
        })}
        {btn('bench', !!u.seat, 'to bench', 'paper', () => act('place', u.id, null), { tip: 'Take it out of the circle. It waits.' })}
        {btn('sell', true, 'release', 'paper-2', gone(() => act('sell', u.id)), { cost: `+${sellVal}`, tip: 'Let it go. Some attention comes back.' })}
      </AnimatePresence>
    </div>
  );
}

function Verbs({ G, u }) {
  const asp = aspectsOf(u.g);
  return (
    <div className="flex flex-wrap gap-2">
      {VERBS.map((v) => {
        const fits = !v.needs || asp.includes(v.needs) || u.traits.includes('fade');
        const busy = !!G.verbs[v.id];
        return (
          <Tooltip key={v.id} content={<span>{v.text} <i className="text-ink-2">{v.time}s.</i>{v.needs && <> Wants something {ASPECTS[v.needs].name}.</>}</span>}>
            <InkButton size="sm" tone={v.needs ? ASPECTS[v.needs].tone === 'ink' ? 'violet' : ASPECTS[v.needs].tone : 'sky'} disabled={!fits || busy || !!u.busy} onClick={() => { act('startVerb', v.id, u.id); }}>
              {v.name}
            </InkButton>
          </Tooltip>
        );
      })}
    </div>
  );
}

function Body({ G, u }) {
  const L = LINKS[u.link - 1];
  const tiers = G.battle?.tiers || aspectTiers(G);
  const s = unitStats(G, u, tiers);
  const ab = ABILITIES[abilityOf(u.g)];
  const echo = unlocked(G, 'echo') ? echoAbilityOf(u.g) : null;
  const tc = {}; for (const t of u.traits) tc[t] = (tc[t] || 0) + 1;
  const where = u.busy ? `away: ${u.busy}` : u.seat ? `held, ring ${u.seat.ring + 1}, gate ${u.seat.dir + 1}` : 'waiting';
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-head text-[24px] leading-[1.05] text-ink"><Scr k={40}>{nameOf(u.g)}</Scr></h2>
          <div className="mt-0.5 font-body text-[12px] italic text-ink-2">{where} · tier {tierOf(u.g)} · {leafCount(u.g)} part{leafCount(u.g) > 1 ? 's' : ''}{u.ghosts ? ` · ${u.ghosts} ghost${u.ghosts > 1 ? 's' : ''}` : ''}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {s.aspects.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-[7px] border-2 border-ink bg-paper px-1.5 py-[2px]">
            <Dot tone={ASPECTS[a].tone} className="h-2.5 w-2.5 border-[1.5px]" />
            <span className="font-head text-[12px] leading-none tracking-wide">{ASPECTS[a].name}</span>
          </span>
        ))}
      </div>

      <Section label={`link ${u.link}/12`}>
        <div className="flex gap-[3px]">
          {LINKS.map((l) => (
            <span key={l.n} className={cn('block h-[8px] flex-1 rounded-full border-[1.5px] border-ink', l.n <= u.link ? 'bg-yolk' : 'bg-paper')} />
          ))}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-head text-[17px] leading-none text-ink">{L.pali}</span>
          <span className="font-body text-[12px] text-ink-2">{L.gloss}</span>
          <span className="ml-auto font-stat text-[12px] text-ink-2">x{L.mult}</span>
        </div>
        <p className="mt-0.5 font-body text-[13px] italic leading-snug text-ink">{L.text}</p>
      </Section>

      <Section label="measures">
        <div className="grid grid-cols-[auto_58px_1fr] items-baseline gap-x-2 gap-y-1">
          {STAT_LINES.map((r) => (
            <div key={r.k} className="contents">
              <span className="font-head text-[13px] leading-tight text-ink">{r.name}</span>
              <span className="text-right font-stat text-[14px] leading-tight text-ink nm-tab">{r.v(s)}</span>
              <span className="font-body text-[11px] italic leading-tight text-ink-2">{r.line}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="ability">
        <p className="font-body text-[13px] leading-snug"><b className="font-head text-[14px] tracking-wide">{ab.name}.</b> {ab.text}</p>
        {echo && <p className="mt-0.5 font-body text-[12px] leading-snug text-ink-2"><b className="font-head">Echo, {ABILITIES[echo].name}.</b> {ABILITIES[echo].text} At half strength.</p>}
      </Section>

      <Section label="traits">
        <div className="flex flex-col gap-1">
          {Object.entries(tc).map(([t, n]) => (
            <p key={t} className="font-body text-[12px] leading-snug">
              <b className="font-head text-[13px] tracking-wide">{t}{n > 1 && <span className="font-stat text-[11px]"> x{n}</span>}.</b> {TRAITS[t]?.text}
            </p>
          ))}
        </div>
      </Section>

      <Section label="genome">
        <div className="max-w-full overflow-x-auto nm-scroll pb-1"><Gene g={u.g} /></div>
      </Section>

      <Section label="do">
        <Ops G={G} u={u} />
      </Section>

      {unlocked(G, 'verbs') && (
        <Section label="give it to">
          <Verbs G={G} u={u} />
        </Section>
      )}
    </>
  );
}

export default function Inspector({ compact }) {
  const G = useGame();
  const u = G.units.find((x) => x.id === game.selected);
  return (
    <AnimatePresence>
      {u && (
        <motion.div
          key="insp"
          className={cn('pointer-events-auto', compact ? 'w-[300px]' : 'w-[340px]')}
          initial={{ opacity: 0, x: 28, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
          transition={POP}
        >
          <Panel
            title={<Scr k={41}>regard</Scr>}
            tone={ASPECTS[aspectsOf(u.g)[0]].tone === 'ink' ? 'violet' : ASPECTS[aspectsOf(u.g)[0]].tone}
            bodyClassName="px-4 pt-2 pb-3"
            actions={
              <button type="button" onClick={() => select(u.id)} className="flex items-center gap-1 rounded-[7px] border-2 border-ink bg-paper px-1.5 py-[2px] font-head text-[12px] uppercase shadow-[1px_2px_0_0_var(--color-ink)] hover:-translate-y-[1px]">
                close <span className="font-stat text-[11px] normal-case">esc</span>
              </button>
            }
          >
            <div style={{ maxHeight: 'calc(var(--band-h) - 62px)' }} className="nm-scroll -mr-2 overflow-y-auto pr-2">
              <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                <Body G={G} u={u} />
              </motion.div>
            </div>
          </Panel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

