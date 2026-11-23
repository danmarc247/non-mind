// Bottom band: shop, attend button, bench + seated strip.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { InkButton, Panel, Tooltip, UnitCard } from '../bits';
import { RingButton } from '../bits/kit.jsx';
import { toneVar } from '../bits';
import {
  FAMILY, ASPECTS, TIER_COST, COSTS, XP_TO_LEVEL, BENCH, unlocked, unitCap, clickValue, leaf, nameOf,
} from '../../game/index.js';
import { act, choose, game, onEvent, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';
import { fmt } from './fmt.js';
import { attend } from './bus.js';
import { Appear, Key, Label, Scr, Shake, UnitGlyph, aspectChips, unitTier, unitTone, POP } from './shared.jsx';

const cardCls = (compact) =>
  cn(compact ? 'w-[96px] [&_.aspect-square]:aspect-[16/10]' : 'w-[108px] [&_.aspect-square]:aspect-[5/3]', '[&_.text-lg]:text-[15px] [&_.mt-2]:mt-1.5');

/** Slim panel header: painted dot, label, then whatever sits to the right. Saves a full title row. */
function Head({ label, tone, k, children }) {
  return (
    <div className="mb-2 flex h-[24px] items-center gap-2">
      <span className="h-3 w-3 shrink-0 rounded-full border-2 border-ink" style={{ background: toneVar(tone) }} />
      <span className="relative shrink-0 font-head text-[17px] leading-none tracking-wider text-ink uppercase">
        <span className="absolute inset-x-[-3px] bottom-[-2px] h-[7px] rounded-full opacity-45" style={{ background: toneVar(tone) }} />
        <span className="relative"><Scr k={k}>{label}</Scr></span>
      </span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ shop */

export function Shop({ G, compact, mobile }) {
  const need = XP_TO_LEVEL[G.level - 1];
  const seatedN = G.units.filter((u) => u.seat).length;
  const cap = unitCap(G);
  return (
    <Panel bodyClassName="px-3 pb-3 pt-2.5">
      <Head label="arrivals" tone="yolk" k={20}>
        <span className="flex-1" />
        <div className="flex items-center gap-3">
          <Tooltip content={`Level ${G.level}. Higher levels hold more at once and draw rarer things. ${G.level < 10 ? `${G.xp} of ${need} toward the next.` : 'There is no higher.'}`}>
            <span className="flex items-center gap-1.5">
              <span className="font-stat text-base leading-none text-ink nm-tab">lv{G.level}</span>
              <span className="relative block h-[9px] w-[54px] overflow-hidden rounded-full border-2 border-ink bg-paper-2">
                <motion.span className="absolute inset-y-0 left-0 bg-ultra" initial={false} animate={{ width: `${G.level >= 10 ? 100 : (100 * G.xp) / need}%` }} transition={POP} />
              </span>
            </span>
          </Tooltip>
          <Tooltip content="Seated, of how many may be seated at once.">
            <span className={cn('font-stat text-base leading-none nm-tab', seatedN >= cap ? 'text-magenta' : 'text-ink')}>{seatedN}/{cap}</span>
          </Tooltip>
        </div>
      </Head>
      <div className={mobile ? 'flex flex-col gap-2' : 'flex items-start gap-2.5'}>
        <div className={mobile ? 'nm-scroll flex gap-2 overflow-x-auto overscroll-contain px-1.5 pt-2.5 pb-2 [touch-action:pan-x]' : 'flex gap-2'}>
          {G.shop.map((id, i) => {
            const f = id && FAMILY[id];
            const cost = f ? TIER_COST[f.tier - 1] : 0;
            return (
              <div key={i} className="relative">
                <Key k={i + 1} className="absolute -top-2 -left-1.5 z-20" />
                <AnimatePresence mode="popLayout" initial={false}>
                  {f ? (
                    <Appear key={`${id}-${i}`} from="up">
                      <Tooltip content={<span><b className="font-head">{f.name}</b>: {f.text}</span>}>
                        <UnitCard
                          name={f.name}
                          tier={f.tier}
                          aspects={compact ? [] : f.aspects.map((a) => ({ name: ASPECTS[a].name, tone: ASPECTS[a].tone }))}
                          cost={cost}
                          dim={G.attention < cost}
                          onClick={() => act('buy', i)}
                          className={cardCls(compact)}
                          reveal={false}
                        >
                          <UnitGlyph g={leaf(id)} link={1} dots={compact ? f.aspects.map((a) => ASPECTS[a].tone) : null} />
                        </UnitCard>
                      </Tooltip>
                    </Appear>
                  ) : (
                    <motion.div
                      key={`empty-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn('rounded-[16px] border-[3px] border-dashed border-ink/25', compact ? 'h-[122px] w-[96px]' : 'h-[164px] w-[108px]')}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <div className={mobile ? 'flex flex-row items-center gap-3' : 'flex w-[104px] flex-col gap-3 pt-1'} data-tut="lookgrow">
          <InkButton size="sm" tone="sky" hotkey="r" disabled={G.attention < COSTS.reroll} onClick={() => act('reroll')} full>
            look <span className="font-stat normal-case">{COSTS.reroll}</span>
          </InkButton>
          <InkButton size="sm" tone="ultra" hotkey="x" disabled={G.attention < COSTS.xp || G.level >= 10} onClick={() => act('buyXp')} full>
            grow <span className="font-stat normal-case">{COSTS.xp}</span>
          </InkButton>
          {!compact && !mobile && (
            <p className="px-0.5 font-body text-[12px] italic leading-snug text-ink-2">
              Two alike become one, further along.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------ attend */

export function AttendButton({ G, compact, size: sizeIn, touch }) {
  const controls = useAnimationControls();
  const [floats, setFloats] = useState([]);
  const n = useRef(0);
  // every attend (button, Space, the core in 3D, attendants excluded) pops the button and floats the gain
  useEffect(
    () =>
      onEvent((e) => {
        if (e.type !== 'attend') return;
        controls.start({ scale: [1, 0.86, 1.07, 1], transition: { duration: 0.26, times: [0, 0.25, 0.65, 1], ease: 'easeOut' } });
        const id = n.current++;
        setFloats((f) => [...f.slice(-10), { id, amt: e.amt, x: (Math.random() - 0.5) * 70, r: (Math.random() - 0.5) * 16 }]);
        setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 900);
      }),
    [controls],
  );
  const size = sizeIn ?? (compact ? 112 : 132);
  const invite = G.stats.clicks === 0;
  return (
    <div className="relative flex flex-col items-center" style={{ width: size + 24 }} data-tut="attend">
      <div className="pointer-events-none absolute bottom-full left-1/2 h-0 w-0">
        <AnimatePresence>
          {floats.map((f) => (
            <motion.span
              key={f.id}
              className="absolute -translate-x-1/2 font-stat text-2xl whitespace-nowrap text-magenta [text-shadow:2px_2px_0_var(--color-ink)]"
              initial={{ opacity: 0, y: 30, x: f.x * 0.3, scale: 0.6, rotate: f.r }}
              animate={{ opacity: [0, 1, 1, 0], y: -60, x: f.x, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.15, 0.8, 0.3, 1] }}
            >
              +{fmt(f.amt)}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {invite && (
          <motion.div key="invite" className="pointer-events-none absolute inset-x-0 top-0 grid place-items-center" style={{ height: size }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            {[0, 0.45].map((delay) => (
              <motion.span key={delay} className="absolute rounded-full border-[3px] border-magenta" style={{ width: size, height: size }}
                animate={{ scale: [1, 1.45], opacity: [0.9, 0] }} transition={{ duration: 0.9, delay, repeat: Infinity, ease: 'easeOut' }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div animate={controls}>
        <RingButton tone="magenta" size={size} onClick={() => attend()} label="Attend">
          <span className={cn('font-head tracking-wider', compact ? 'text-[24px]' : 'text-[28px]')}><Scr k={30}>ATTEND</Scr></span>
          <span className="mt-1 font-stat text-[13px] text-paper/90 nm-tab">+{fmt(clickValue(G))}</span>
        </RingButton>
      </motion.div>
      {!touch && (
        <span className="mt-2 flex items-center gap-1.5">
          <Key k="space" />
        </span>
      )}
      <AnimatePresence>
        {invite && (
          <motion.div key="hint" className={cn('pointer-events-none absolute bottom-[calc(100%+6px)] flex flex-col', touch ? 'right-0 items-end' : 'left-1/2 w-[230px] -translate-x-1/2 items-center')}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={POP}>
            <span className="whitespace-nowrap rounded-[10px] border-[3px] border-ink bg-yolk px-3 py-1.5 text-center font-head text-[18px] leading-tight tracking-wide text-ink uppercase shadow-[2px_3px_0_0_var(--color-ink)]">
              {touch ? 'tap here' : <>click, or press <span className="rounded-[6px] border-2 border-ink bg-paper px-1.5">space</span></>}
            </span>
            <motion.span className={touch ? 'mr-6' : undefined} animate={{ y: [0, 5, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}>
              <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
                <path d="M20 4 C 17 14, 23 22, 20 32" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" />
                <path d="M11 24 L20 34 L29 23" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ bench + seated */

export function Seated({ G }) {
  const seated = G.units.filter((u) => u.seat).sort((a, b) => a.seat.ring - b.seat.ring || a.seat.dir - b.seat.dir);
  if (!seated.length) return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Label className="shrink-0 pl-2">held</Label>
      <div className="nm-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
        <AnimatePresence initial={false}>
          {seated.map((u) => (
            <motion.button
              key={u.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={POP}
              type="button"
              onClick={() => choose(u.id)}
              className={cn(
                'flex h-[26px] shrink-0 items-center gap-1.5 rounded-[8px] border-2 border-ink bg-paper px-2 font-head text-[13px] leading-none text-ink shadow-[1px_2px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5',
                game.selected === u.id && 'bg-magenta text-paper',
                game.pending && game.pending.a !== u.id && 'outline-2 outline-dashed outline-offset-1 outline-magenta',
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink" style={{ background: toneVar(unitTone(u)) }} />
              <span className="max-w-[120px] truncate">{nameOf(u.g)}</span>
              {u.link > 1 && <span className="font-stat text-[11px]">{u.link}</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Bench({ G, compact }) {
  const bench = G.units.filter((u) => !u.seat && !u.busy);
  return (
    <Panel bodyClassName="px-3 pb-3 pt-2.5" className="min-w-0 flex-1">
      <Head label="waiting" tone="teal" k={21}>
        <span className={cn('shrink-0 font-stat text-base leading-none nm-tab', bench.length >= BENCH ? 'text-magenta' : 'text-ink')}>{bench.length}/{BENCH}</span>
        <Seated G={G} />
        {!G.units.some((u) => u.seat) && <span className="flex-1" />}
      </Head>
      <div className={cn('nm-scroll flex gap-2 overflow-x-auto px-1 pt-1.5 pb-2', compact ? 'min-h-[128px]' : 'min-h-[172px]')}>
        <AnimatePresence initial={false} mode="popLayout">
          {bench.map((u) => (
            <Appear key={u.id} from="up" layout className="shrink-0">
              <div className={cn('rounded-[18px]', game.pending && game.pending.a !== u.id && 'outline-[3px] outline-dashed outline-offset-2 outline-magenta')}>
                <UnitCard
                  name={nameOf(u.g)}
                  tier={unitTier(u)}
                  aspects={compact ? [] : aspectChips(u.g)}
                  selected={game.selected === u.id}
                  onClick={() => choose(u.id)}
                  className={cardCls(compact)}
                  reveal={false}
                >
                  <UnitGlyph g={u.g} link={u.link} dots={compact ? aspectChips(u.g).map((a) => a.tone) : null} />
                </UnitCard>
              </div>
            </Appear>
          ))}
        </AnimatePresence>
        {!bench.length && (
          <p className="self-center px-2 font-body text-sm italic text-ink-2/80">Nothing waits. What is bought sits here until it is given a place.</p>
        )}
      </div>
    </Panel>
  );
}

export default function Bottom({ compact }) {
  const G = useGame();
  const shop = unlocked(G, 'shop');
  return (
    <div className="pointer-events-none flex items-end gap-3">
      {!shop && <div className="flex-1" />}
      <AnimatePresence initial={false}>
        {shop && (
          <Appear key="shop" from="up" className="pointer-events-auto shrink-0" data-tut="shop">
            <Shake seed={21}><Shop G={G} compact={compact} /></Shake>
          </Appear>
        )}
      </AnimatePresence>
      <Shake seed={22} className="pointer-events-auto shrink-0 pb-1"><AttendButton G={G} compact={compact} /></Shake>
      {!shop && <div className="flex-1" />}
      <AnimatePresence initial={false}>
        {shop && (
          <Appear key="bench" from="up" delay={0.05} className="pointer-events-auto flex min-w-0 flex-1" data-tut="bench">
            <Shake seed={23} className="flex min-w-0 flex-1"><Bench G={G} compact={compact} /></Shake>
          </Appear>
        )}
      </AnimatePresence>
    </div>
  );
}
