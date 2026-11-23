// Surprises beside Attend: now and then (engine: G.gift) a smaller ring fades in for 15 s. Taking it is
// always generous; leaving it costs nothing and it simply goes. The idle hints and the guide ignore it.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Tooltip } from '../bits';
import { RingButton } from '../bits/kit.jsx';
import { GIFTS, GIFT_LIFETIME } from '../../game/index.js';
import { act, onEvent, useGame } from '../../game/store.js';
import { cn } from '../../lib/cn';

const TONE = { transcend: 'sky', actualize: 'yolk', convolute: 'violet' };
const RAYS = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);

export default function Surprise({ size = 68, touch = false, className }) {
  const G = useGame();
  const gift = G.gift && GIFTS[G.gift.kind] ? G.gift : null;
  const [burst, setBurst] = useState(null);
  useEffect(() => onEvent((e) => {
    if (e.type !== 'giftTake') return;
    setBurst({ kind: e.kind, key: performance.now() });
    setTimeout(() => setBurst(null), 520);
  }), []);

  const R = size / 2 + 5, C = 2 * Math.PI * R, box = size + 18;
  const def = gift && GIFTS[gift.kind];
  const tone = gift ? TONE[gift.kind] || 'teal' : 'teal';
  const left = gift ? Math.max(0, Math.min(1, gift.t / GIFT_LIFETIME)) : 0;

  return (
    <div className={cn('pointer-events-none', className)} style={{ width: box, height: box }}>
      <AnimatePresence>
        {gift && (
          <motion.div
            key={gift.kind}
            data-tut="gift"
            className="pointer-events-auto absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.4, ease: 'easeOut' } }}
            transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1.15] }}
          >
            <motion.div className="relative grid place-items-center" style={{ width: box, height: box }} animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
              {/* the thin ring drains over the fifteen seconds */}
              <svg width={box} height={box} className="pointer-events-none absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx={box / 2} cy={box / 2} r={R} fill="none" stroke="var(--color-ink)" strokeOpacity="0.18" strokeWidth="3" />
                <motion.circle cx={box / 2} cy={box / 2} r={R} fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - left) }} transition={{ duration: 0.25, ease: 'easeOut' }} />
              </svg>
              <Tooltip side={touch ? 'left' : 'top'} content={def.plain}>
                <RingButton tone={tone} size={size} onClick={() => act('takeGift')} label={def.name}>
                  <span className={cn('font-head uppercase', def.name.length > 8 ? 'text-[11px] tracking-tight' : 'text-[12px] tracking-wide')}>{def.name}</span>
                </RingButton>
              </Tooltip>
            </motion.div>
            <motion.p
              className={cn('pointer-events-none absolute w-max max-w-[190px] rounded-[10px] border-2 border-ink bg-paper px-2 py-1 font-body text-[13px] italic leading-snug text-ink shadow-[2px_3px_0_0_var(--color-ink)]',
                touch ? 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2 text-right' : 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 text-center')}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.3 }}
            >
              {def.text}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* taken: a small burst where it was */}
      <AnimatePresence>
        {burst && (
          <motion.svg key={burst.key} width={box} height={box} viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true"
            initial={{ opacity: 1, scale: 0.5 }} animate={{ opacity: 0, scale: 1.9 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
            {RAYS.map((a) => (
              <line key={a} x1={Math.cos(a) * (size * 0.3)} y1={Math.sin(a) * (size * 0.3)} x2={Math.cos(a) * (size * 0.52)} y2={Math.sin(a) * (size * 0.52)}
                stroke={`var(--color-${TONE[burst.kind] === 'yolk' ? 'tangerine' : TONE[burst.kind] || 'magenta'})`} strokeWidth="5" strokeLinecap="round" />
            ))}
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
}
