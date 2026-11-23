// Ported from Cult UI "Texture Card" (cult-ui.com, MIT), restyled for NON-MIND.
// Nested hairline borders inside a thick ink outline give a layered "painted edge".
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import { toneVar } from './tones';

const TextureCardStyled = forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-[20px] border-[3px] border-ink shadow-[3px_4px_0_0_var(--color-ink)]',
      'bg-gradient-to-b from-paper to-paper-2',
      className,
    )}
    {...props}
  >
    <div className="rounded-[17px] border border-white/80">
      <div className="rounded-[16px] border border-ink/10">
        <div className="rounded-[15px] border border-white/60">
          <div className="w-full rounded-[14px] border border-ink/5 text-ink-2">{children}</div>
        </div>
      </div>
    </div>
  </div>
));
TextureCardStyled.displayName = 'TextureCardStyled';

// `--radius` drives every nested radius (default 18px). `tone` tints the outer outline.
const TextureCard = forwardRef(({ className, children, tone, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      '[--radius:18px] rounded-[calc(var(--radius))] border-[3px] border-ink bg-paper',
      'shadow-[3px_4px_0_0_var(--color-ink)]',
      className,
    )}
    style={tone ? { borderColor: toneVar(tone), ...style } : style}
    {...props}
  >
    <div className="rounded-[calc(var(--radius)-3px)] border border-white/80">
      <div className="rounded-[calc(var(--radius)-4px)] border border-ink/10">
        <div className="rounded-[calc(var(--radius)-5px)] border border-white/60">
          <div className="w-full rounded-[calc(var(--radius)-6px)] border border-ink/5 bg-gradient-to-b from-paper to-paper-2/70 text-ink-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  </div>
));
TextureCard.displayName = 'TextureCard';

const TextureCardHeader = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('first:pt-5 last:pb-5', className)} {...props} />
));
TextureCardHeader.displayName = 'TextureCardHeader';

const TextureCardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('pl-2 font-head text-xl leading-tight text-ink', className)} {...props} />
));
TextureCardTitle.displayName = 'TextureCardTitle';

const TextureCardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('pl-2 font-body text-sm text-ink-2', className)} {...props} />
));
TextureCardDescription.displayName = 'TextureCardDescription';

const TextureCardContent = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-5 py-3', className)} {...props} />
));
TextureCardContent.displayName = 'TextureCardContent';

const TextureCardFooter = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center justify-between gap-2 px-5 py-3', className)} {...props} />
));
TextureCardFooter.displayName = 'TextureCardFooter';

const TextureSeparator = ({ className }) => (
  <div
    className={cn(
      'border border-t-white/80 border-r-transparent border-b-ink/15 border-l-transparent',
      className,
    )}
  />
);

export {
  TextureCard,
  TextureCardHeader,
  TextureCardStyled,
  TextureCardFooter,
  TextureCardTitle,
  TextureSeparator,
  TextureCardDescription,
  TextureCardContent,
};

export default TextureCard;
