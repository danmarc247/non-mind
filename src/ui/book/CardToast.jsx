// CardToast: a paper plate at the bottom centre for 4 s after a card is collected (game event
// 'cardCollect' via onEvent, or window event 'nonmind:cardtoast' with detail { id }). Shows the mark,
// the name and the quotation; a click opens the book. Text is read at render time (locale swaps in place).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { onEvent } from '../../game/store.js';
import { cardById } from '../../game/content/cards.js';
import { t } from '../../i18n/index.js';
import CardMark from './CardMark.jsx';
import { quoteText } from './boon.js';

const LIFE_MS = 4000;
const POP = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };

export default function CardToast({ className = 'bottom-[10.5rem]', life = LIFE_MS }) {
  const [shown, setShown] = useState(null);   // { id, key }
  const timer = useRef(0);
  useEffect(() => {
    const show = (id) => {
      if (!cardById[id]) return;
      clearTimeout(timer.current);
      setShown({ id, key: Date.now() });
      timer.current = setTimeout(() => setShown(null), life);
    };
    const off = onEvent((e) => { if (e.type === 'cardCollect') show(e.id); });
    const win = (e) => show(e.detail?.id);
    window.addEventListener('nonmind:cardtoast', win);
    return () => { off(); window.removeEventListener('nonmind:cardtoast', win); clearTimeout(timer.current); };
  }, [life]);
  const card = shown && cardById[shown.id];
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-4 ${className}`}>
      <AnimatePresence>
        {card && (
          <motion.button key={shown.key} type="button" data-card-toast={card.id}
            onClick={() => { setShown(null); window.dispatchEvent(new Event('nonmind:book')); }}
            className="pointer-events-auto flex w-[min(460px,100%)] items-center gap-3 rounded-[22px] border-[3px] border-ink bg-paper px-3 py-2.5 text-left text-ink shadow-[4px_5px_0_var(--color-ink)] hover:-translate-y-0.5"
            initial={{ opacity: 0, y: 18, scale: 0.94, rotate: -0.8 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ ...POP, opacity: { duration: 0.18 } }}>
            <motion.span className="shrink-0" initial={{ rotate: -14, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} transition={{ ...POP, delay: 0.05 }}>
              <CardMark card={card} size={58} />
            </motion.span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="font-head text-[17px] leading-tight">{card.name}</span>
                <span className="font-stat text-[11px] text-ink-2">{card.n}</span>
              </span>
              <span className="mt-0.5 block font-body text-[14px] leading-snug italic text-ink-2">{quoteText(card.quote)}</span>
              <span className="mt-1 block font-head text-[13px] text-ink-2">{t('kept in the book')} · b</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
