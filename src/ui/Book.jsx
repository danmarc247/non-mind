// The Book: every card place, numbered 0..21 in order, on one paper page. A held card shows its mark,
// name, quotation, principle and boon; an empty place is only a dashed outline and its number.
// Opens on window event 'nonmind:book' or key B (not while typing, not over another modal); Esc closes.
// Click a held card to enlarge it (shared layout). New cards glow until the book has shown them once.
// Card text is read at render time: the locale swaps CARDS in place.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useGame } from '../game/store.js';
import { CARDS } from '../game/content/cards.js';
import { t } from '../i18n/index.js';
import CardMark from './book/CardMark.jsx';
import CardToast from './book/CardToast.jsx';
import { boonText, readSeen, writeSeen } from './book/boon.js';
import { toneVar } from './bits/tones.js';

export { CardToast };
export const BOOK_EVENT = 'nonmind:book';
const POP = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };
const LAYOUT = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };
const ORDER = [...CARDS].sort((a, b) => a.n - b.n);
// 6-5-6-5 on wide pages: the rows of five start half a place in
const STAGGER = new Set([6, 17]);

/** The hotkey guard, shared with the lazy stub in App.jsx. */
export const bookKey = (e) => {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return false;
  return e.key === 'b' || e.key === 'B';
};

function Boon({ card, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-stat text-[11px] text-ink ${className}`}>
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink" style={{ background: toneVar(card.tone) }} />
      {boonText(card.boon)}
    </span>
  );
}

function Place({ card, held, fresh, onOpen, stagger }) {
  const pos = stagger ? 'lg:col-start-2' : '';
  if (!held) {
    return (
      <div className={`flex h-[168px] items-center justify-center rounded-[16px] border-[2.5px] border-dashed border-ink/25 lg:col-span-2 lg:h-[158px] ${pos}`} aria-label={`${card.n}`}>
        <span className="font-outline text-[44px] leading-none text-ink/30">{card.n}</span>
      </div>
    );
  }
  return (
    <motion.button type="button" layoutId={`book-card-${card.id}`} onClick={() => onOpen(card.id)} data-place={card.n}
      className={`group relative flex h-[168px] flex-col overflow-hidden rounded-[16px] border-[3px] border-ink bg-paper p-2.5 text-left text-ink lg:col-span-2 lg:h-[158px] ${pos} ${fresh ? 'shadow-[0_0_0_5px_color-mix(in_srgb,var(--color-yolk)_55%,transparent),0_0_22px_6px_color-mix(in_srgb,var(--color-yolk)_45%,transparent),3px_4px_0_var(--color-ink)]' : 'shadow-[3px_4px_0_var(--color-ink)]'}`}
      whileHover={{ y: -3, rotate: -0.6 }} whileTap={{ scale: 0.97 }} transition={LAYOUT}>
      {fresh && <span className="absolute top-1.5 right-1.5 rounded-full border-2 border-ink bg-yolk px-1.5 font-stat text-[11px] leading-[16px]">{t('new')}</span>}
      <span className="flex items-start gap-2">
        <span className="-mt-0.5 -ml-0.5 shrink-0 transition-transform duration-200 group-hover:-rotate-6"><CardMark card={card} size={44} /></span>
        <span className="min-w-0 pt-0.5">
          <span className="block font-stat text-[11px] leading-none text-ink-2">{card.n}</span>
          <span className="mt-0.5 block font-head text-[15px] leading-[1.05]">{card.name}</span>
        </span>
      </span>
      <span className="mt-1 line-clamp-2 font-body text-[12.5px] leading-[1.25] italic">{card.quote}</span>
      <span className="mt-0.5 line-clamp-2 font-body text-[11px] leading-[1.25] text-ink-2">{card.principle}</span>
      <Boon card={card} className="mt-auto pt-0.5" />
    </motion.button>
  );
}

function Enlarged({ card, onClose }) {
  return (
    <motion.div className="absolute inset-0 z-20 flex items-center justify-center bg-paper/70 p-4 backdrop-blur-[2px]" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} transition={{ duration: 0.18 }}>
      <motion.div layoutId={`book-card-${card.id}`} onClick={(e) => e.stopPropagation()} data-enlarged={card.id}
        className="relative flex max-h-full w-[min(440px,100%)] flex-col items-center overflow-y-auto rounded-[26px] border-4 border-ink bg-paper px-6 pt-5 pb-6 text-center text-ink shadow-[8px_10px_0_var(--color-ink)]"
        transition={LAYOUT}>
        <span className="font-outline text-[34px] leading-none text-ink-2">{card.n}</span>
        <motion.span initial={{ rotate: -10, scale: 0.85 }} animate={{ rotate: 0, scale: 1 }} transition={{ ...POP, delay: 0.06 }}>
          <CardMark card={card} size={150} className="my-2" />
        </motion.span>
        <h3 className="font-head text-[30px] leading-none">{card.name}</h3>
        <svg className="mt-1.5 mb-3 h-2.5 w-40" viewBox="0 0 160 10" aria-hidden="true"><path d="M2 6 C 30 1, 55 9, 85 5 S 135 2, 158 6" fill="none" stroke={toneVar(card.tone)} strokeWidth="4.5" strokeLinecap="round" /></svg>
        <p className="font-body text-[19px] leading-snug italic">{card.quote}</p>
        <p className="mt-3 font-body text-[14.5px] leading-snug text-ink-2">{card.principle}</p>
        <Boon card={card} className="mt-4 rounded-full border-[2.5px] border-ink bg-paper-2 px-3 py-1 text-[12px]" />
        <button type="button" onClick={onClose} className="absolute top-3 right-3 rounded-full border-[3px] border-ink bg-paper px-2.5 font-head text-sm leading-6 hover:rotate-3">{t('back')}</button>
      </motion.div>
    </motion.div>
  );
}

// the completed state: a hand-drawn band in all twenty-two tones under the title
function Band() {
  return (
    <svg className="mt-1 h-3 w-[min(330px,70vw)]" viewBox="0 0 330 12" aria-hidden="true">
      {ORDER.map((c, i) => (
        <path key={c.id} d={`M${4 + i * 14.6} ${6 + Math.sin(i * 1.3) * 2} q 7 ${i % 2 ? -4 : 4} 13 0`} fill="none" stroke={toneVar(c.tone)} strokeWidth="5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export default function Book() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const selRef = useRef(null); selRef.current = sel;
  const [seen, setSeen] = useState(readSeen);
  const held = useGame((G) => G.cards || []);
  const heldSet = useMemo(() => new Set(held), [held, held.length]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const key = (e) => {
      if (e.key === 'Escape') { if (selRef.current) setSel(null); else setOpen(false); return; }
      if (!bookKey(e)) return;
      if (document.querySelector('[aria-modal="true"]:not([data-modal="book"])')) return;
      toggle();
    };
    window.addEventListener(BOOK_EVENT, toggle); window.addEventListener('keydown', key);
    return () => { window.removeEventListener(BOOK_EVENT, toggle); window.removeEventListener('keydown', key); };
  }, []);
  // closing the book counts as having seen everything in it
  useEffect(() => {
    if (open) return;
    setSel(null);
    setSeen((s) => { const n = new Set(s); let add = false; for (const id of held) if (!n.has(id)) { n.add(id); add = true; } if (add) writeSeen(n); return add ? n : s; });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const openCard = (id) => { setSel(id); setSeen((s) => { if (s.has(id)) return s; const n = new Set(s); n.add(id); writeSeen(n); return n; }); };

  const count = ORDER.filter((c) => heldSet.has(c.id)).length, done = count === ORDER.length;
  const line = count === 0 ? t('Twenty-two places, numbered, and nothing yet to put in them.')
    : done ? t('Every place holds what it waited for, as a harbour holds at night.')
    : t('What drifted in and was caught stays here, through every reset.');
  const selCard = sel && ORDER.find((c) => c.id === sel);

  return (
    <AnimatePresence>
      {open && (
        <motion.div aria-modal="true" role="dialog" aria-label={t('the book')} data-modal="book"
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-2 backdrop-blur-[3px] sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.18 }} onClick={() => setOpen(false)}>
          <motion.div onClick={(e) => e.stopPropagation()} data-complete={done ? '1' : '0'}
            className={`relative flex h-[min(92vh,900px)] w-[min(1220px,98vw)] flex-col overflow-hidden rounded-[28px] border-4 border-ink bg-paper ${done ? 'shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-yolk)_60%,transparent),10px_12px_0_var(--color-ink)]' : 'shadow-[10px_12px_0_var(--color-ink)]'}`}
            initial={reduce ? false : { y: 26, scale: 0.96, rotate: -0.6 }} animate={{ y: 0, scale: 1, rotate: 0 }} exit={{ y: 18, scale: 0.97, opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
            <header className="flex shrink-0 items-start justify-between gap-3 border-b-[3px] border-ink/15 px-4 pt-3 pb-2.5 sm:px-7">
              <div className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-head text-[30px] leading-none sm:text-[36px]">{t('the book')}</h2>
                  <span className="font-stat text-[20px] leading-none text-ink sm:text-[24px]" data-count={count}>{count} <span className="text-ink-2">{t('of')} 22</span></span>
                </div>
                {done && <Band />}
                <p className="mt-1 font-body text-[14px] leading-snug italic text-ink-2 sm:text-[15px]">{line}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-full border-[3px] border-ink bg-yolk px-3 py-0.5 font-head text-sm text-ink shadow-[2px_3px_0_var(--color-ink)] hover:rotate-3">{t('close')} · esc</button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-7 sm:py-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-3.5">
                {ORDER.map((c) => (
                  <Place key={c.id} card={c} held={heldSet.has(c.id)} fresh={heldSet.has(c.id) && !seen.has(c.id) && sel !== c.id} onOpen={openCard} stagger={STAGGER.has(c.n)} />
                ))}
              </div>
            </div>
            <AnimatePresence>{selCard && <Enlarged key={selCard.id} card={selCard} onClose={() => setSel(null)} />}</AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
