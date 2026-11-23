// Ported from Cult UI "Minimal Card" (cult-ui.com, MIT), restyled for NON-MIND.
// next/image replaced with a plain <img>.
import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const MinimalCard = forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-[18px] border-[3px] border-ink bg-paper p-2 no-underline transition-colors hover:bg-white',
      'shadow-[3px_4px_0_0_var(--color-ink)]',
      className,
    )}
    {...props}
  >
    {children}
  </div>
));
MinimalCard.displayName = 'MinimalCard';

const MinimalCardImage = forwardRef(({ className, alt, src, children, ...props }, ref) => (
  <div ref={ref} className={cn('relative mb-4 h-[160px] w-full rounded-[12px] bg-paper-2', className)} {...props}>
    {src ? (
      <img src={src} alt={alt} width={200} height={200} className="absolute inset-0 h-full w-full rounded-[12px] object-cover" />
    ) : (
      children
    )}
    <div className="pointer-events-none absolute inset-0 rounded-[12px] shadow-[0_0_0_2px_var(--color-ink),inset_0_0_0_3px_rgba(251,246,236,0.7)]" />
  </div>
));
MinimalCardImage.displayName = 'MinimalCardImage';

const MinimalCardTitle = forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('mt-1 px-1 font-head text-xl leading-tight text-ink', className)} {...props} />
));
MinimalCardTitle.displayName = 'MinimalCardTitle';

const MinimalCardDescription = forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('px-1 pb-2 font-body text-sm text-ink-2', className)} {...props} />
));
MinimalCardDescription.displayName = 'MinimalCardDescription';

const MinimalCardContent = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
));
MinimalCardContent.displayName = 'MinimalCardContent';

const MinimalCardFooter = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
));
MinimalCardFooter.displayName = 'MinimalCardFooter';

export { MinimalCard, MinimalCardImage, MinimalCardTitle, MinimalCardDescription, MinimalCardContent, MinimalCardFooter };
export default MinimalCard;
