// Ported from Cult UI "Texture Button" (cult-ui.com, MIT), restyled for NON-MIND.
// Outer shell + inner face; `tone` (accent name) colours the accent and paint variants.
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';
import { inkOn, toneVar } from './tones';

const buttonVariantsOuter = cva('relative bg-origin-border', {
  variants: {
    variant: {
      primary:
        'w-full border-[3px] border-ink bg-ink p-0 shadow-[3px_4px_0_0_var(--color-ink)] transition duration-150 ease-out active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
      accent:
        'w-full border-[3px] border-ink bg-(--tone) p-0 shadow-[3px_4px_0_0_var(--color-ink)] transition duration-150 ease-out active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
      destructive:
        'w-full border-[3px] border-ink bg-blood p-0 shadow-[3px_4px_0_0_var(--color-ink)] transition duration-150 ease-out active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
      secondary:
        'w-full border-[3px] border-ink bg-paper p-0 shadow-[3px_4px_0_0_var(--color-ink)] transition duration-150 ease-out active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
      minimal:
        'group/texture-button w-full border-2 border-ink/70 bg-paper/70 p-0 hover:bg-paper active:bg-paper-2',
      icon: 'group/texture-button rounded-full border-[3px] border-ink bg-paper p-0 shadow-[2px_3px_0_0_var(--color-ink)] active:translate-y-[2px] active:shadow-none',
      // Chunky painted key used by the kit's InkButton.
      paint:
        'group/texture-button w-auto border-[3px] border-ink bg-(--tone) p-0 shadow-[3px_4px_0_0_var(--color-ink)] transition-[transform,box-shadow] duration-75 ease-out hover:-translate-y-px hover:shadow-[3px_5px_0_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
    },
    size: {
      sm: 'rounded-[9px]',
      default: 'rounded-[12px]',
      lg: 'rounded-[14px]',
      icon: 'rounded-full',
    },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
});

const innerDivVariants = cva('relative flex h-full w-full items-center justify-center gap-2 overflow-hidden font-head tracking-wide', {
  variants: {
    variant: {
      primary: 'bg-gradient-to-b from-ink-2 to-ink text-paper hover:from-ink hover:to-ink',
      accent:
        'bg-(--tone) text-(--tone-ink) before:pointer-events-none before:absolute before:inset-x-2 before:top-[3px] before:h-[38%] before:rounded-full before:bg-white/25 hover:brightness-105',
      destructive:
        'bg-blood text-paper before:pointer-events-none before:absolute before:inset-x-2 before:top-[3px] before:h-[38%] before:rounded-full before:bg-white/25 hover:brightness-105',
      secondary: 'bg-gradient-to-b from-paper to-paper-2 text-ink hover:from-white hover:to-paper',
      minimal: 'bg-transparent text-ink group-hover/texture-button:bg-paper-2/60',
      icon: 'rounded-full bg-gradient-to-b from-paper to-paper-2 text-ink group-active/texture-button:bg-paper-2',
      paint:
        'bg-(--tone) text-(--tone-ink) before:pointer-events-none before:absolute before:inset-x-2.5 before:top-[3px] before:h-[36%] before:rounded-full before:bg-white/30 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[5px] after:bg-ink/15',
    },
    size: {
      sm: 'rounded-[6px] px-3 py-1 text-sm',
      default: 'rounded-[9px] px-4 py-2 text-base',
      lg: 'rounded-[11px] px-6 py-3 text-xl',
      icon: 'rounded-full p-1.5',
    },
  },
  defaultVariants: { variant: 'primary', size: 'default' },
});

const TextureButton = forwardRef(
  ({ children, variant = 'primary', size = 'default', asChild = false, tone = 'ultra', className, innerClassName, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariantsOuter({ variant, size }), className)}
        ref={ref}
        style={{ '--tone': toneVar(tone), '--tone-ink': inkOn(tone), ...style }}
        {...props}
      >
        <div className={cn(innerDivVariants({ variant, size }), innerClassName)}>{children}</div>
      </Comp>
    );
  },
);
TextureButton.displayName = 'TextureButton';

export { TextureButton, buttonVariantsOuter as textureButtonOuterVariants, innerDivVariants as textureButtonInnerVariants };
export default TextureButton;
