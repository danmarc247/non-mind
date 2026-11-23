// Ported from Aceternity UI "Encrypted Text" (ui.aceternity.com), restyled for NON-MIND.
// Scrambles characters and reveals the real text left to right.
import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { cn } from '../../lib/cn';

const DEFAULT_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?';

function generateRandomCharacter(charset) {
  return charset.charAt(Math.floor(Math.random() * charset.length));
}

function generateGibberishPreservingSpaces(original, charset) {
  if (!original) return '';
  let result = '';
  for (let i = 0; i < original.length; i += 1) {
    result += original[i] === ' ' ? ' ' : generateRandomCharacter(charset);
  }
  return result;
}

export const EncryptedText = ({
  text,
  className,
  revealDelayMs = 50,
  charset = DEFAULT_CHARSET,
  flipDelayMs = 50,
  encryptedClassName = 'text-ink/35',
  revealedClassName = 'text-ink',
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const [revealCount, setRevealCount] = useState(0);
  const [, setFlip] = useState(0);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastFlipTimeRef = useRef(0);
  const scrambleCharsRef = useRef(text ? generateGibberishPreservingSpaces(text, charset).split('') : []);

  useEffect(() => {
    if (!isInView) return undefined;

    // Reset state for a fresh animation whenever dependencies change (incl. `text`).
    scrambleCharsRef.current = (text ? generateGibberishPreservingSpaces(text, charset) : '').split('');
    startTimeRef.current = performance.now();
    lastFlipTimeRef.current = startTimeRef.current;
    setRevealCount(0);

    let isCancelled = false;
    const totalLength = text ? text.length : 0;

    const update = (now) => {
      if (isCancelled) return;
      const elapsedMs = now - startTimeRef.current;
      const currentRevealCount = Math.min(totalLength, Math.floor(elapsedMs / Math.max(1, revealDelayMs)));
      setRevealCount(currentRevealCount);
      if (currentRevealCount >= totalLength) return;

      if (now - lastFlipTimeRef.current >= Math.max(0, flipDelayMs)) {
        for (let index = currentRevealCount; index < totalLength; index += 1) {
          scrambleCharsRef.current[index] = text[index] === ' ' ? ' ' : generateRandomCharacter(charset);
        }
        lastFlipTimeRef.current = now;
        setFlip((f) => (f + 1) % 1024); // repaint scramble even when revealCount did not move
      }
      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);
    return () => {
      isCancelled = true;
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isInView, text, revealDelayMs, charset, flipDelayMs]);

  if (!text) return null;

  return (
    <motion.span ref={ref} className={cn(className)} aria-label={text}>
      {text.split('').map((char, index) => {
        const isRevealed = index < revealCount;
        const displayChar = isRevealed
          ? char
          : char === ' '
            ? ' '
            : (scrambleCharsRef.current[index] ?? generateRandomCharacter(charset));
        return (
          <span key={index} aria-hidden="true" className={cn(isRevealed ? revealedClassName : encryptedClassName)}>
            {displayChar}
          </span>
        );
      })}
    </motion.span>
  );
};

export default EncryptedText;
