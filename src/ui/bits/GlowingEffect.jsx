// Ported from Aceternity UI "Glowing Effect" (ui.aceternity.com), restyled for NON-MIND.
// A conic border glow that follows the pointer around the parent's rounded rect.
// The parent must be `position: relative` and carry the border radius.
import { memo, useCallback, useEffect, useRef } from 'react';
import { animate } from 'motion/react';
import { cn } from '../../lib/cn';
import { toneHex } from './tones';

const PAINT_GRADIENT = `radial-gradient(circle, #ff2d7a 10%, #ff2d7a00 20%),
  radial-gradient(circle at 40% 40%, #ffd21f 5%, #ffd21f00 15%),
  radial-gradient(circle at 60% 60%, #17b5a6 10%, #17b5a600 20%),
  radial-gradient(circle at 40% 60%, #2a2bff 10%, #2a2bff00 20%),
  repeating-conic-gradient(
    from 236.84deg at 50% 50%,
    #ff2d7a 0%,
    #ffd21f calc(25% / var(--repeating-conic-gradient-times)),
    #17b5a6 calc(50% / var(--repeating-conic-gradient-times)),
    #2a2bff calc(75% / var(--repeating-conic-gradient-times)),
    #ff2d7a calc(100% / var(--repeating-conic-gradient-times))
  )`;

function toneGradient(hex) {
  return `radial-gradient(circle, ${hex} 10%, ${hex}00 22%),
  repeating-conic-gradient(
    from 236.84deg at 50% 50%,
    ${hex} 0%,
    #fbf6ec calc(40% / var(--repeating-conic-gradient-times)),
    ${hex} calc(100% / var(--repeating-conic-gradient-times))
  )`;
}

const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = 'default', // 'default' (paint palette) | 'white' (ink, kept for API compat) | 'ink'
    tone, // optional accent name: tints the glow with one color
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
  }) => {
    const containerRef = useRef(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef(0);

    const handleMove = useCallback(
      (e) => {
        if (!containerRef.current) return;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;
          if (e) lastPosition.current = { x: mouseX, y: mouseY };

          const center = [left + width * 0.5, top + height * 0.5];
          const distanceFromCenter = Math.hypot(mouseX - center[0], mouseY - center[1]);
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty('--active', '0');
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty('--active', isActive ? '1' : '0');
          if (!isActive) return;

          const currentAngle = parseFloat(element.style.getPropertyValue('--start')) || 0;
          const targetAngle = (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;
          const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
          const newAngle = currentAngle + angleDiff;

          animate(currentAngle, newAngle, {
            duration: movementDuration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (value) => element.style.setProperty('--start', String(value)),
          });
        });
      },
      [inactiveZone, proximity, movementDuration],
    );

    useEffect(() => {
      if (disabled) return;
      const handleScroll = () => handleMove();
      const handlePointerMove = (e) => handleMove(e);
      window.addEventListener('scroll', handleScroll, { passive: true });
      document.body.addEventListener('pointermove', handlePointerMove, { passive: true });
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        window.removeEventListener('scroll', handleScroll);
        document.body.removeEventListener('pointermove', handlePointerMove);
      };
    }, [handleMove, disabled]);

    const ink = variant === 'white' || variant === 'ink';
    const gradient = ink
      ? `repeating-conic-gradient(from 236.84deg at 50% 50%, #1b1030, #1b1030 calc(25% / var(--repeating-conic-gradient-times)))`
      : tone
        ? toneGradient(toneHex(tone))
        : PAINT_GRADIENT;

    return (
      <>
        <div
          className={cn(
            'pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity',
            glow && 'opacity-100',
            ink && 'border-ink',
            disabled && '!block',
          )}
        />
        <div
          ref={containerRef}
          style={{
            '--blur': `${blur}px`,
            '--spread': spread,
            '--start': '0',
            '--active': '0',
            '--glowingeffect-border-width': `${borderWidth}px`,
            '--repeating-conic-gradient-times': '5',
            '--gradient': gradient,
          }}
          className={cn(
            'pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity',
            glow && 'opacity-100',
            blur > 0 && 'blur-[var(--blur)]',
            className,
            disabled && '!hidden',
          )}
        >
          <div
            className={cn(
              'glow',
              'rounded-[inherit]',
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              'after:[border:var(--glowingeffect-border-width)_solid_transparent]',
              'after:[background:var(--gradient)] after:[background-attachment:fixed]',
              'after:opacity-[var(--active)] after:transition-opacity after:duration-300',
              'after:[mask-clip:padding-box,border-box]',
              'after:[mask-composite:intersect]',
              'after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]',
            )}
          />
        </div>
      </>
    );
  },
);

GlowingEffect.displayName = 'GlowingEffect';

export { GlowingEffect };
export default GlowingEffect;
