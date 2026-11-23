// Ported from Aceternity UI "Moving Border" (ui.aceternity.com), restyled for NON-MIND.
// A blob of paint travels along the border of a button / container.
import { useRef } from 'react';
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from 'motion/react';
import { cn } from '../../lib/cn';
import { toneVar } from './tones';

export function Button({
  borderRadius = '1rem',
  children,
  as: Component = 'button',
  containerClassName,
  borderClassName,
  duration,
  className,
  tone = 'magenta',
  style,
  ...otherProps
}) {
  return (
    <Component
      className={cn(
        'relative h-14 w-44 overflow-hidden bg-ink p-[3px] text-xl shadow-[3px_4px_0_0_var(--color-ink)]',
        containerClassName,
      )}
      style={{ borderRadius, ...style }}
      {...otherProps}
    >
      <div className="absolute inset-0" style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}>
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div
            className={cn('h-20 w-20 opacity-100', borderClassName)}
            style={{ background: `radial-gradient(${toneVar(tone)} 40%, transparent 62%)` }}
          />
        </MovingBorder>
      </div>
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center bg-paper font-head text-lg tracking-wide text-ink antialiased',
          className,
        )}
        style={{ borderRadius: `calc(${borderRadius} * 0.8)` }}
      >
        {children}
      </div>
    </Component>
  );
}

export const MovingBorder = ({ children, duration = 3000, rx, ry, ...otherProps }) => {
  const pathRef = useRef(null);
  const progress = useMotionValue(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      const pxPerMillisecond = length / duration;
      progress.set((time * pxPerMillisecond) % length);
    }
  });

  const x = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).x ?? 0);
  const y = useTransform(progress, (val) => pathRef.current?.getPointAtLength(val).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: 'absolute', top: 0, left: 0, display: 'inline-block', transform }}>
        {children}
      </motion.div>
    </>
  );
};

export { Button as MovingBorderButton };
export default MovingBorder;
