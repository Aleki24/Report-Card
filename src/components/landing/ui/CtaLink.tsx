import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const ctaLinkVariants = cva(
  'group inline-flex min-h-11 items-center justify-center gap-3 rounded-xl font-semibold tracking-wide transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-[0_8px_32px_var(--color-accent-glow)] hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 motion-reduce:hover:translate-y-0',
        outline: 'border border-border bg-card font-medium text-foreground hover:border-primary',
      },
      size: {
        md: 'px-5 py-2.5 text-sm',
        lg: 'px-7 py-3 text-[0.9375rem]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'lg' },
  },
);

type CtaLinkProps = Omit<ComponentProps<typeof Link>, 'children'> &
  VariantProps<typeof ctaLinkVariants> & { children: ReactNode };

/** Landing call-to-action link; primary gets an arrow, outline a chevron. */
export function CtaLink({ variant, size, className, children, ...props }: CtaLinkProps) {
  const Icon = variant === 'outline' ? ChevronRight : ArrowRight;

  return (
    <Link className={cn(ctaLinkVariants({ variant, size }), className)} {...props}>
      {children}
      <Icon
        aria-hidden
        className={cn(
          'size-4 transition-transform duration-300 group-hover:translate-x-1',
          variant === 'outline' && 'text-muted-foreground',
        )}
      />
    </Link>
  );
}
