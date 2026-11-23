// Ported from Aceternity UI "Text Generate Effect" (ui.aceternity.com), restyled for NON-MIND.
// Words fade/unblur in one after another.
import { useEffect } from 'react';
import { motion, stagger, useAnimate } from 'motion/react';
import { cn } from '../../lib/cn';

export const TextGenerateEffect = ({ words, className, filter = true, duration = 0.5, staggerDelay = 0.2 }) => {
  const [scope, animate] = useAnimate();
  const wordsArray = (words || '').split(' ');

  useEffect(() => {
    if (!scope.current) return;
    animate(
      'span',
      { opacity: 1, filter: filter ? 'blur(0px)' : 'none' },
      { duration: duration || 1, delay: stagger(staggerDelay) },
    );
    // re-run when the sentence changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.current, words]);

  return (
    <div className={cn('font-body font-semibold text-ink', className)}>
      <div className="text-2xl leading-snug tracking-wide">
        <motion.div ref={scope} key={words}>
          {wordsArray.map((word, idx) => (
            <motion.span
              key={word + idx}
              className="opacity-0"
              style={{ filter: filter ? 'blur(10px)' : 'none' }}
            >
              {word}{' '}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default TextGenerateEffect;
