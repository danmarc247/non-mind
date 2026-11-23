// The Manual: the whole README, rendered inside the game as a paper folio.
// Source of truth is README.md itself (imported raw), so the two can never drift.
import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { AnimatePresence, motion } from 'motion/react';
import readme from '../../README.md?raw';

const TONES = ['magenta', 'ultra', 'yolk', 'tangerine', 'teal', 'violet', 'blood', 'leaf'];
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function build(md) {
  // drop the screenshots section and any images: the game is already on screen
  md = md.replace(/^## Screenshots[\s\S]*?(?=^## |(?![\s\S]))/m, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const title = (md.match(/^# (.+)$/m) || [, 'NON-MIND'])[1];
  const parts = md.replace(/^# .+$/m, '').split(/^(?=## )/m);
  const intro = parts[0].trim();
  const sections = parts.slice(1).filter((p) => !/^## (Contents|Table of contents)\s*$/im.test(p)).map((p, i) => {
    const name = p.match(/^## (.+)$/m)[1].trim();
    const html = marked.parse(p.replace(/^## .+$/m, ''), { gfm: true })
      .replace(/<a /g, '<a target="_blank" rel="noreferrer" ')
      .replace(/<table>/g, '<div class="nm-table"><table>').replace(/<\/table>/g, '</table></div>');
    return { id: slug(name) || `s${i}`, name, html, tone: TONES[i % TONES.length] };
  });
  return { title, intro: marked.parse(intro, { gfm: true }), sections };
}

export default function Manual() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const doc = useMemo(() => build(readme), []);
  const body = useRef(null);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const key = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'm' || e.key === 'M') toggle();
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('nonmind:manual', toggle); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('nonmind:manual', toggle); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { if (open && body.current) body.current.scrollTo({ top: 0 }); }, [active, open]);
  const sec = doc.sections[active];
  return (
    <>
      <button onClick={() => setOpen(true)} title="Manual (M)"
        className="pointer-events-auto fixed left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border-[3px] border-ink bg-paper px-4 py-1 font-head text-sm tracking-wide text-ink shadow-[3px_4px_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-[-1.5deg] active:translate-y-0.5">
        MANUAL <span className="ml-1 rounded border border-ink px-1 font-body text-[10px]">M</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setOpen(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              className="relative flex h-[min(88vh,900px)] w-[min(1180px,96vw)] overflow-hidden rounded-[28px] border-4 border-ink bg-paper shadow-[10px_12px_0_var(--color-ink)]"
              initial={{ y: 26, scale: 0.96, rotate: -0.6 }} animate={{ y: 0, scale: 1, rotate: 0 }} exit={{ y: 18, scale: 0.97, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}>
              {/* spine: contents */}
              <nav className="flex w-[250px] shrink-0 flex-col gap-1 overflow-y-auto border-r-4 border-ink bg-paper-2 p-4">
                <div className="mb-2 font-title text-3xl leading-none text-ink">{doc.title}</div>
                <div className="mb-3 font-body text-xs italic text-ink-2">the manual</div>
                {doc.sections.map((s, i) => (
                  <button key={s.id} onClick={() => setActive(i)}
                    className={`group relative rounded-xl px-3 py-1.5 text-left font-head text-[15px] leading-tight transition-all duration-150 ${i === active ? 'translate-x-1 bg-ink text-paper' : 'text-ink hover:translate-x-1 hover:bg-paper'}`}>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full border-2 border-ink align-middle" style={{ background: `var(--color-${s.tone})` }} />
                    {s.name}
                  </button>
                ))}
              </nav>
              {/* page */}
              <div ref={body} className="nm-manual relative flex-1 overflow-y-auto px-10 py-8">
                <button onClick={() => setOpen(false)} className="absolute right-5 top-5 rounded-full border-[3px] border-ink bg-yolk px-3 py-0.5 font-head text-sm text-ink shadow-[2px_3px_0_var(--color-ink)] hover:rotate-3">close · esc</button>
                <AnimatePresence mode="wait">
                  <motion.article key={sec.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                    {active === 0 && <div className="nm-intro mb-6 pr-28" dangerouslySetInnerHTML={{ __html: doc.intro }} />}
                    <h2 className="mb-1 font-title text-5xl leading-none" style={{ color: `var(--color-${sec.tone})`, WebkitTextStroke: '1.5px var(--color-ink)' }}>{sec.name}</h2>
                    <svg className="mb-5 h-3 w-64" viewBox="0 0 260 12"><path d="M2 7 C 40 1, 70 12, 110 6 S 190 2, 258 7" fill="none" stroke={`var(--color-${sec.tone})`} strokeWidth="5" strokeLinecap="round" /></svg>
                    <div dangerouslySetInnerHTML={{ __html: sec.html }} />
                    <div className="mt-10 flex justify-between font-head text-sm">
                      {active > 0 ? <button className="rounded-full border-[3px] border-ink px-4 py-1 hover:-translate-x-1" onClick={() => setActive(active - 1)}>← {doc.sections[active - 1].name}</button> : <span />}
                      {active < doc.sections.length - 1 && <button className="rounded-full border-[3px] border-ink bg-ink px-4 py-1 text-paper hover:translate-x-1" onClick={() => setActive(active + 1)}>{doc.sections[active + 1].name} →</button>}
                    </div>
                  </motion.article>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
