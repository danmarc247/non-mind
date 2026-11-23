// Ported from Aceternity UI "Noise Background" (ui.aceternity.com), restyled for NON-MIND.
// Drifting colour blobs under a grain layer. The remote noise.webp of the original is
// replaced by an inline SVG turbulence texture (works offline, no network fetch).
import { useEffect, useRef } from 'react';
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '../../lib/cn';

export const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.06  0 0 0 0 0.19  0 0 0 1.6 -0.35'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function GradientLayer({ springX, springY, gradientColor, opacity, multiplier }) {
  const x = useTransform(springX, (val) => val * multiplier);
  const y = useTransform(springY, (val) => val * multiplier);
  const background = useMotionTemplate`radial-gradient(circle at ${x}px ${y}px, ${gradientColor} 0%, transparent 50%)`;
  return <motion.div className="absolute inset-0" style={{ opacity, background }} />;
}

export const NoiseBackground = ({
  children,
  className,
  containerClassName,
  gradientColors = ['#ff2d7a', '#2a2bff', '#ffd21f'],
  noiseIntensity = 0.2,
  speed = 0.1,
  backdropBlur = false,
  animating = true,
}) => {
  const containerRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 30 });
  const springY = useSpring(y, { stiffness: 100, damping: 30 });
  const topGradientX = useTransform(springX, (val) => val * 0.1 - 50);

  const velocityRef = useRef({ x: 0, y: 0 });
  const lastDirectionChangeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const randomVelocity = () => {
    const angle = Math.random() * Math.PI * 2;
    const magnitude = speed * (0.5 + Math.random() * 0.5);
    return { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude };
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    };
    measure();
    x.set(sizeRef.current.w / 2);
    y.set(sizeRef.current.h / 2);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [x, y]);

  useEffect(() => {
    velocityRef.current = randomVelocity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  useAnimationFrame((time) => {
    if (!animating) return;
    // cached size instead of getBoundingClientRect per frame (cheap when many are mounted)
    const { w: maxX, h: maxY } = sizeRef.current;
    if (!maxX) return;

    if (time - lastDirectionChangeRef.current > 1500 + Math.random() * 1500) {
      velocityRef.current = randomVelocity();
      lastDirectionChangeRef.current = time;
    }

    const deltaTime = 16;
    let newX = x.get() + velocityRef.current.x * deltaTime;
    let newY = y.get() + velocityRef.current.y * deltaTime;
    const padding = 20;

    if (newX < padding || newX > maxX - padding || newY < padding || newY > maxY - padding) {
      velocityRef.current = randomVelocity();
      lastDirectionChangeRef.current = time;
      newX = Math.max(padding, Math.min(maxX - padding, newX));
      newY = Math.max(padding, Math.min(maxY - padding, newY));
    }
    x.set(newX);
    y.set(newY);
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative overflow-hidden rounded-[18px] border-[3px] border-ink bg-paper-2 p-2',
        'shadow-[3px_4px_0_0_var(--color-ink)]',
        backdropBlur && "after:absolute after:inset-0 after:h-full after:w-full after:backdrop-blur-lg after:content-['']",
        containerClassName,
      )}
      style={{ '--noise-opacity': noiseIntensity }}
    >
      <GradientLayer springX={springX} springY={springY} gradientColor={gradientColors[0]} opacity={0.55} multiplier={1} />
      <GradientLayer springX={springX} springY={springY} gradientColor={gradientColors[1]} opacity={0.4} multiplier={0.7} />
      <GradientLayer
        springX={springX}
        springY={springY}
        gradientColor={gradientColors[2] || gradientColors[0]}
        opacity={0.45}
        multiplier={1.2}
      />

      <motion.div
        className="absolute inset-x-0 top-0 h-1.5 opacity-90 blur-[2px]"
        style={{ background: `linear-gradient(to right, ${gradientColors.join(', ')})`, x: animating ? topGradientX : 0 }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[var(--noise-opacity)]"
        style={{ backgroundImage: GRAIN_URL, mixBlendMode: 'multiply' }}
      />

      <div className={cn('relative z-10', className)}>{children}</div>
    </div>
  );
};

export default NoiseBackground;
