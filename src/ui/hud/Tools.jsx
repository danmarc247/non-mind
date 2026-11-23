// Tool rings: codex, manual, save, lineage. Each just announces a window event; the owning
// component (Codex here; Manual / SaveMenu / Lineage elsewhere) opens itself. Keys M and L belong
// to those components; C is bound in Hud.jsx.
import { RingButton } from '../bits/kit.jsx';
import { cn } from '../../lib/cn';
import { Scr } from './shared.jsx';

const fire = (name) => () => window.dispatchEvent(new Event(name));

export const TOOLS = [
  { id: 'codex', label: 'codex', tone: 'paper', key: 'c', event: 'nonmind:codex' },
  { id: 'manual', label: 'manual', tone: 'sky', key: 'm', event: 'nonmind:manual' },
  { id: 'save', label: 'save', tone: 'yolk', key: null, event: 'nonmind:save' },
  { id: 'lineage', label: 'lineage', tone: 'rose', key: 'l', event: 'nonmind:lineage' },
];

export default function Tools({ size = 56, layout = 'grid', hotkeys = true, className }) {
  const text = size >= 56 ? 'text-[13px]' : 'text-[11px]';
  return (
    <div className={cn(layout === 'grid' ? 'grid grid-cols-2 gap-1.5' : layout === 'col' ? 'flex flex-col gap-1.5' : 'flex gap-1.5', className)}>
      {TOOLS.map((t, i) => (
        <span key={t.id} data-tut={t.id} className="inline-flex">
          <RingButton tone={t.tone} size={size} hotkey={hotkeys ? t.key : undefined} hotkeyPos="corner" onClick={fire(t.event)} label={t.label}>
            <span className={cn('font-head uppercase', t.label.length > 6 ? 'text-[11.5px] tracking-tight' : cn(text, 'tracking-wide'))}><Scr k={60 + i}>{t.label}</Scr></span>
          </RingButton>
        </span>
      ))}
    </div>
  );
}
