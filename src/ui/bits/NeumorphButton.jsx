// Ported from Cult UI "Neumorph Button" (cult-ui.com, MIT), restyled for NON-MIND.
// Soft pressed-in key with a springy motion tap. `intent="tone"` + `tone` for any accent.
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';
import { inkOn, toneVar } from './tones';

const buttonVariants = cva(
  'flex items-center justify-center gap-1 border-[3px] border-ink px-4 font-head tracking-wide transition-[box-shadow,background-color,filter] active:transition-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      intent: {
        default: [
          'bg-ink text-paper',
          'hover:enabled:bg-ink-2',
          '[box-shadow:inset_0px_-4px_0px_0px_#0d0718,_2px_3px_0px_0px_#1b1030]',
          'active:[box-shadow:inset_0px_-1.5px_0px_0px_#0d0718,_0px_1px_0px_0px_#1b1030]',
          'disabled:shadow-none',
        ],
        primary: [
          'bg-ultra text-paper',
          'hover:enabled:brightness-110',
          '[box-shadow:inset_0px_-4px_0px_0px_#1415b8,_2px_3px_0px_0px_#1b1030]',
          'active:[box-shadow:inset_0px_-1.5px_0px_0px_#1415b8,_0px_1px_0px_0px_#1b1030]',
          'disabled:shadow-none',
        ],
        secondary: [
          'bg-paper text-ink',
          'hover:enabled:bg-white',
          '[box-shadow:inset_0px_-4px_0px_0px_#e6d9c0,_2px_3px_0px_0px_#1b1030]',
          'active:[box-shadow:inset_0px_-1.5px_0px_0px_#e6d9c0,_0px_1px_0px_0px_#1b1030]',
          'disabled:shadow-none',
        ],
        danger: [
          'bg-blood text-paper',
          'hover:enabled:brightness-110',
          '[box-shadow:inset_0px_-4px_0px_0px_#a3141b,_2px_3px_0px_0px_#1b1030]',
          'active:[box-shadow:inset_0px_-1.5px_0px_0px_#a3141b,_0px_1px_0px_0px_#1b1030]',
          'disabled:shadow-none',
        ],
        tone: [
          'bg-(--tone) text-(--tone-ink)',
          'hover:enabled:brightness-105',
          '[box-shadow:inset_0px_-4px_0px_0px_rgba(27,16,48,0.28),_2px_3px_0px_0px_#1b1030]',
          'active:[box-shadow:inset_0px_-1.5px_0px_0px_rgba(27,16,48,0.28),_0px_1px_0px_0px_#1b1030]',
          'disabled:shadow-none',
        ],
      },
      size: {
        small: 'h-9 rounded-[9px] px-3 py-1 text-sm',
        medium: 'h-11 rounded-[12px] px-4 py-2 text-lg',
        large: 'h-14 rounded-[14px] px-6 py-3 text-2xl',
      },
      fullWidth: { true: 'w-full' },
    },
    compoundVariants: [
      { intent: ['default', 'primary', 'secondary', 'danger', 'tone'], size: 'medium', className: 'uppercase' },
    ],
    defaultVariants: { intent: 'default', size: 'medium' },
  },
);

const NeumorphButton = ({ className, intent, size, fullWidth, tone = 'magenta', children, loading = false, disabled, style, ...props }) => (
  <motion.button
    className={cn(buttonVariants({ intent, size, fullWidth }), className)}
    disabled={disabled || loading}
    whileTap={disabled ? undefined : { scale: 0.97 }}
    whileHover={disabled ? undefined : { scale: 1.02 }}
    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
    style={{ '--tone': toneVar(tone), '--tone-ink': inkOn(tone), ...style }}
    {...props}
  >
    {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
    <motion.span initial={{ opacity: 1 }} animate={{ opacity: loading ? 0.7 : 1 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.span>
  </motion.button>
);

export { NeumorphButton, buttonVariants as neumorphButtonVariants };
export default NeumorphButton;
