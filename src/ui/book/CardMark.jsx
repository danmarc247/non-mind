// A card's mark as inline SVG: a brushed swatch in the card's tone under the same ink mark the
// drifting card paints in its shader (both come from src/gfx/cards/symbols.js). SVG turbulence gives
// the wobble and the dry bristle breakup, seeded per card so every mark has its own hand.
import { useId } from 'react';
import { symbolSVG } from '../../gfx/cards/symbols.js';
import { toneVar } from '../bits/tones.js';

export default function CardMark({ card, size = 56, className = '', swatch = true }) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const seed = (card?.n ?? 0) + 3, tone = toneVar(card?.tone || 'yolk');
  const light = `color-mix(in srgb, ${tone} 55%, var(--color-paper))`;
  const deep = `color-mix(in srgb, ${tone} 82%, var(--color-ink))`;
  const parts = symbolSVG(card?.symbol);
  const rot = ((card?.n ?? 0) * 47) % 360;
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <filter id={`sw${raw}`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`ik${raw}`} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="2.6" numOctaves="2" seed={seed + 11} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.075" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="1.4 26" numOctaves="1" seed={seed + 5} result="b" />
          <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.75" result="bm" />
          <feComposite in="d" in2="bm" operator="in" />
        </filter>
      </defs>
      {swatch && (
        <g filter={`url(#sw${raw})`} transform={`rotate(${rot})`}>
          <ellipse cx="0.02" cy="0.02" rx="0.86" ry="0.8" fill={tone} />
          <path d="M-0.62 -0.28 C -0.2 -0.5, 0.25 -0.42, 0.66 -0.18" fill="none" stroke={light} strokeWidth="0.13" strokeLinecap="round" opacity="0.8" />
          <path d="M-0.5 0.34 C -0.1 0.2, 0.3 0.3, 0.58 0.44" fill="none" stroke={light} strokeWidth="0.09" strokeLinecap="round" opacity="0.65" />
          <path d="M-0.7 0.05 C -0.3 -0.02, 0.2 0.08, 0.72 0.02" fill="none" stroke={deep} strokeWidth="0.06" strokeLinecap="round" opacity="0.35" />
        </g>
      )}
      <g filter={`url(#ik${raw})`}>
        <g transform="scale(0.86,-0.86)" fill="var(--color-ink)" stroke="var(--color-ink)" strokeLinecap="round" strokeLinejoin="round">
          {parts.map((p, i) => (p.tag === 'circle' ? <circle key={i} {...p.attrs} /> : <path key={i} {...p.attrs} />))}
        </g>
      </g>
    </svg>
  );
}
