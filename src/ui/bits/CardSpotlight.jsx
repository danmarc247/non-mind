// Ported from Aceternity UI "Card Spotlight" (ui.aceternity.com), restyled for NON-MIND.
// A pointer-following spotlight; the CanvasRevealEffect (one WebGL context) is mounted
// only while the card is hovered, so dozens of cards cost no GL contexts at rest.
import { useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { CanvasRevealEffect } from './CanvasRevealEffect';
import { cn } from '../../lib/cn';
import { toneRgb, toneRgba } from './tones';

export const CardSpotlight = ({
  children,
  radius = 350,
  color, // spotlight fill; defaults to a light wash of `tone`
  tone = 'magenta',
  revealColors, // [[r,g,b], ...] for the dot matrix; defaults to tone + ultra
  reveal = true, // set false to skip the WebGL dot matrix entirely
  className,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  ...props
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovering, setIsHovering] = useState(false);

  function handleMouseMove(e) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
    onMouseMove?.(e);
  }

  const maskImage = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, white, transparent 80%)`;

  return (
    <div
      className={cn('group/spotlight relative rounded-[18px] border-[3px] border-ink bg-paper p-10', className)}
      onMouseMove={handleMouseMove}
      onMouseEnter={(e) => {
        setIsHovering(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovering(false);
        onMouseLeave?.(e);
      }}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] opacity-0 transition duration-300 group-hover/spotlight:opacity-100"
        style={{ backgroundColor: color ?? toneRgba(tone, 0.16), maskImage, WebkitMaskImage: maskImage }}
      >
        {reveal && isHovering && (
          <CanvasRevealEffect
            animationSpeed={5}
            containerClassName="bg-transparent absolute inset-0 pointer-events-none"
            colors={revealColors ?? [toneRgb(tone), toneRgb('ultra')]}
            dotSize={3}
            showGradient={false}
          />
        )}
      </motion.div>
      {children}
    </div>
  );
};

export default CardSpotlight;
