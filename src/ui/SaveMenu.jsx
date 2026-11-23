// Save menu: export, import, save now, wipe. Self-contained; opens on the `nonmind:save` window event.
// Key S is deliberately not bound (S belongs to the game).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { exportSave, importSave, saveNow, wipe, lastSavedAt, useVersion } from '../game/store.js';

const POP = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };
const btn = 'rounded-full border-[3px] border-ink px-4 py-1 font-head text-[15px] leading-tight text-ink shadow-[2px_3px_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-40';

function Row({ tone, title, line, children }) {
  return (
    <div className="rounded-2xl border-[3px] border-ink bg-paper-2 p-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border-2 border-ink" style={{ background: `var(--color-${tone})` }} />
        <div className="font-head text-lg leading-none text-ink">{title}</div>
      </div>
      <div className="mb-2 mt-1 font-body text-[13px] italic text-ink-2">{line}</div>
      {children}
    </div>
  );
}

const clock = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null);

export default function SaveMenu() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState(null);       // { tone, text }
  const [confirm, setConfirm] = useState(false);
  const file = useRef(null);
  useVersion();                                  // re-render when a save lands

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('nonmind:save', toggle); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('nonmind:save', toggle); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { if (!open) { setConfirm(false); setNote(null); } }, [open]);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(false), 5000); return () => clearTimeout(t); }, [confirm]);

  const say = (tone, t) => setNote({ tone, t, k: Date.now() });
  const copy = async () => {
    const code = exportSave();
    try { await navigator.clipboard.writeText(code); say('teal', 'Carried. The clipboard holds it now.'); }
    catch { setText(code); say('tangerine', 'The clipboard would not take it. The code is in the box below instead.'); }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([exportSave()], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url; a.download = `non-mind-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say('teal', 'A file now holds it.');
    } catch { say('blood', 'The file could not be made.'); }
  };
  const doImport = (str) => {
    const r = importSave(str);
    if (r.ok) { setText(''); say('teal', 'It is as it was. Everything here is the other one now.'); }
    else say('blood', `This is not a save that can be held. (${r.error})`);
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return say('blood', 'This is not a save that can be held. (too large)');
    try { doImport(await f.text()); } catch { say('blood', 'The file could not be read.'); }
  };
  const doSave = () => { const r = saveNow(); say(r.ok ? 'teal' : 'blood', r.ok ? 'Kept.' : 'Nothing here will keep it. (storage unavailable)'); };
  const doWipe = () => {
    if (!confirm) { setConfirm(true); return; }
    wipe(); setConfirm(false); setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title="Save and load"
        className="pointer-events-auto fixed left-[calc(50%+4.75rem)] top-3 z-30 rounded-full border-[3px] border-ink bg-paper px-4 py-1 font-head text-sm tracking-wide text-ink shadow-[3px_4px_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-[1.5deg] active:translate-y-0.5">
        SAVE
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[3px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} transition={{ duration: 0.18 }} onClick={() => setOpen(false)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              className="relative flex max-h-[92vh] w-[min(560px,96vw)] flex-col gap-3 overflow-y-auto rounded-[28px] border-4 border-ink bg-paper p-6 shadow-[10px_12px_0_var(--color-ink)]"
              initial={{ y: 26, scale: 0.96, rotate: -0.6 }} animate={{ y: 0, scale: 1, rotate: 0 }} exit={{ y: 18, scale: 0.97, opacity: 0, transition: { duration: 0.14 } }}
              transition={POP}>
              <button onClick={() => setOpen(false)} className="absolute right-5 top-5 rounded-full border-[3px] border-ink bg-yolk px-3 py-0.5 font-head text-sm text-ink shadow-[2px_3px_0_var(--color-ink)] hover:rotate-3">close · esc</button>
              <div>
                <h2 className="font-title text-4xl leading-none" style={{ color: 'var(--color-magenta)', WebkitTextStroke: '1.5px var(--color-ink)' }}>Keep</h2>
                <div className="mt-1 font-body text-[13px] italic text-ink-2">What is kept can be carried. Save, export or load a game.</div>
              </div>

              <Row tone="yolk" title="Now" line="Nothing is kept until it is kept. The game also keeps itself every ten seconds.">
                <div className="flex flex-wrap items-center gap-3">
                  <button className={`${btn} bg-yolk`} onClick={doSave}>Save now</button>
                  <span className="font-stat text-xs text-ink-2">{lastSavedAt ? `last saved ${clock(lastSavedAt)}` : 'not saved this visit'}</span>
                </div>
              </Row>

              <Row tone="teal" title="Carry" line="Turn this life into a line of text. Copy it, or keep it as a file.">
                <div className="flex flex-wrap gap-3">
                  <button className={`${btn} bg-teal`} onClick={copy}>Copy save to clipboard</button>
                  <button className={`${btn} bg-paper`} onClick={download}>Download as file</button>
                </div>
              </Row>

              <Row tone="ultra" title="Return" line="Put a line of text back. This life is replaced by the one it holds.">
                <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={3} placeholder="NM1.…"
                  className="mb-2 w-full resize-none rounded-xl border-[3px] border-ink bg-paper p-2 font-stat normal-case text-xs text-ink outline-none focus:border-ultra" />
                <div className="flex flex-wrap gap-3">
                  <button className={`${btn} bg-ultra text-paper`} disabled={!text.trim()} onClick={() => doImport(text)}>Load from text</button>
                  <button className={`${btn} bg-paper`} onClick={() => file.current && file.current.click()}>Load from file</button>
                  <input ref={file} type="file" accept=".txt,text/plain" className="hidden" onChange={onFile} />
                </div>
              </Row>

              <AnimatePresence mode="wait">
                {note && (
                  <motion.div key={note.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={POP}
                    className="rounded-xl border-[3px] border-ink px-3 py-1.5 font-body text-sm italic text-ink" style={{ background: `color-mix(in srgb, var(--color-${note.tone}) 35%, var(--color-paper))` }}>
                    {note.t}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="rounded-2xl border-[3px] border-blood bg-paper p-3">
                <div className="font-head text-lg leading-none text-blood">Wipe</div>
                <div className="mb-2 mt-1 font-body text-[13px] italic text-ink-2">{confirm ? 'Once more, and it is gone. The saved copy goes with it.' : 'Erases the saved game and begins a new one. Export first to keep a copy.'}</div>
                <button className={`${btn} ${confirm ? 'bg-blood text-paper' : 'bg-paper'}`} onClick={doWipe}>{confirm ? 'Yes, wipe everything' : 'Wipe'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
