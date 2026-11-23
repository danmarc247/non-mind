// Tool rings: codex, manual, save, lineage. Each just announces a window event; the owning
// component (Codex here; Manual / SaveMenu / Lineage elsewhere) opens itself. Keys M and L belong
// to those components; C is bound in Hud.jsx.
import { useEffect, useState } from 'react';
import { RingButton } from '../bits/kit.jsx';
import { cn } from '../../lib/cn';
import { getLocale, LOCALE_SWITCH } from '../../i18n/index.js';
import { Scr } from './shared.jsx';

const fire = (name) => () => window.dispatchEvent(new Event(name));

export const TOOLS = [
  { id: 'codex', label: 'codex', tone: 'paper', key: 'c', event: 'nonmind:codex' },
  { id: 'manual', label: 'manual', tone: 'sky', key: 'm', event: 'nonmind:manual' },
  { id: 'save', label: 'save', tone: 'yolk', key: null, event: 'nonmind:save' },
  { id: 'lineage', label: 'lineage', tone: 'rose', key: 'l', event: 'nonmind:lineage' },
  { id: 'book', label: 'book', tone: 'violet', key: 'b', event: 'nonmind:book' },
  { id: 'again', label: 'again', tone: 'tangerine', key: null, event: 'nonmind:restart' },
  { id: 'sound', label: 'sound', tone: 'teal', key: null, event: 'nonmind:mute' },
  // picture quality: auto (the game eases the picture when frames run slow), or a fixed low, medium, high
  { id: 'quality', label: 'auto', tone: 'sky', key: null, event: 'nonmind:quality' },
  // hidden until the German interface translation is complete (see LOCALE_SWITCH in src/i18n/index.js)
  ...(LOCALE_SWITCH ? [{ id: 'locale', label: 'en / de', tone: 'violet', key: null, event: 'nonmind:locale' }] : []),
];

const SESSION = new Set(['save', 'again', 'sound', 'quality', 'locale']);
const QUALITY = ['auto', 'low', 'medium', 'high'];
const readQuality = () => { try { const q = localStorage.getItem('non-mind-quality'); return QUALITY.includes(q) ? q : 'auto'; } catch { return 'auto'; } };

export default function Tools({ size = 56, layout = 'grid', hotkeys = true, className }) {
  const text = size >= 56 ? 'text-[13px]' : 'text-[12px]';
  // the app announces the sound state; the ring shows it
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    const on = (e) => setMuted(!!e.detail);
    window.addEventListener('nonmind:muted', on);
    return () => window.removeEventListener('nonmind:muted', on);
  }, []);
  const [qual, setQual] = useState(readQuality);
  useEffect(() => {
    const on = (e) => { if (QUALITY.includes(e.detail?.setting)) setQual(e.detail.setting); };
    window.addEventListener('nonmind:quality-changed', on);
    return () => window.removeEventListener('nonmind:quality-changed', on);
  }, []);
  // "plain" is the fifth stop of the same ring: the painted shaders are put away and the colours stay
  const [plainOn, setPlainOn] = useState(() => { try { return localStorage.getItem('non-mind-plain') === '1'; } catch { return false; } });
  useEffect(() => {
    const on = (e) => setPlainOn(!!e.detail?.plain);
    window.addEventListener('nonmind:plain-changed', on);
    return () => window.removeEventListener('nonmind:plain-changed', on);
  }, []);
  const STOPS = [...QUALITY, 'plain'];
  const shown = plainOn ? 'plain' : qual;
  const nextQuality = () => {
    const n = STOPS[(STOPS.indexOf(shown) + 1) % STOPS.length];
    window.dispatchEvent(new CustomEvent('nonmind:plain', { detail: n === 'plain' }));
    if (n !== 'plain') { setQual(n); window.dispatchEvent(new CustomEvent('nonmind:quality', { detail: n })); }
  };
  const view = (t) => (t.id === 'quality' ? { ...t, label: shown } : t.id === 'sound' && muted ? { ...t, label: 'quiet', tone: 'paper-2' } : t.id === 'locale' ? { ...t, label: getLocale() === 'de' ? 'deutsch' : 'english' } : t);
  // two groups: what belongs to play (codex, manual, lineage, book), then, set apart and smaller, what belongs
  // to the session (save, again, sound)
  const all = TOOLS.map(view);
  const play = all.filter((t) => !SESSION.has(t.id)), session = all.filter((t) => SESSION.has(t.id));
  const small = Math.round(size * 0.8);
  const ring = (t, i, sz) => (
    <span key={t.id} data-tut={t.id} className="inline-flex">
      <RingButton tone={t.tone} size={sz} hotkey={hotkeys ? t.key : undefined} hotkeyPos="corner" onClick={t.id === 'quality' ? nextQuality : fire(t.event)} label={t.id === 'quality' ? `picture quality: ${shown}` : t.id === 'sound' ? (muted ? 'sound is off' : 'sound is on') : t.label} aria-pressed={t.id === 'sound' ? muted : undefined}>
        <span className={cn('font-head uppercase', sz < 50 ? 'text-[11px] tracking-tight' : t.label.length > 6 ? 'text-[12px] tracking-tight' : cn(text, 'tracking-wide'))}><Scr k={60 + i}>{t.label}</Scr></span>
      </RingButton>
    </span>
  );
  const row = layout === 'row';
  return (
    <div className={cn('flex items-center', row ? 'gap-5' : 'flex-col gap-4')}>
      <div className={cn(layout === 'grid' ? 'grid grid-cols-2 gap-2.5' : layout === 'col' ? 'flex flex-col gap-2.5' : 'flex gap-2.5', className)}>
        {play.map((t, i) => ring(t, i, size))}
      </div>
      <div className={cn('flex items-center justify-center gap-2', layout === 'col' && 'flex-col')}>
        {session.map((t, i) => ring(t, play.length + i, small))}
      </div>
    </div>
  );
}
