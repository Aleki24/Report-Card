import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SectionProps = ComponentPropsWithoutRef<'section'> & {
  /** Narrower measure for text-led sections such as the FAQ. */
  width?: 'default' | 'narrow';
};

/** Page-width landing section with the shared gutter and vertical rhythm. */
export function Section({ width = 'default', className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        'mx-auto w-full scroll-mt-24 px-4 py-16 sm:px-6 md:py-24 lg:px-12',
        width === 'narrow' ? 'max-w-4xl' : 'max-w-7xl',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

type SectionHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  /** Trailing words of the title rendered in the italic accent treatment. */
  highlight?: string;
  description?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  highlight,
  description,
  align = 'center',
  className,
}: SectionHeaderProps) {
  const centered = align === 'center';

  return (
    <header
      className={cn(
        'mb-10 flex max-w-2xl flex-col gap-4 md:mb-14',
        centered ? 'mx-auto items-center text-center' : 'mx-auto items-center text-center lg:mx-0 lg:items-start lg:text-left',
        className,
      )}
    >
      <Eyebrow centered={centered}>{eyebrow}</Eyebrow>
      <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
        {title}
        {highlight && (
          <>
            {' '}
            <span className="text-primary italic">{highlight}</span>
          </>
        )}
      </h2>
      {description && (
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
      )}
    </header>
  );
}

type EyebrowProps = {
  children: ReactNode;
  /** Draw the hairline rule on both sides (centred headers) or only before the text. */
  centered?: boolean;
  /** Replaces the leading rule, e.g. an icon. */
  leading?: ReactNode;
  className?: string;
};

/** Small uppercase kicker that sits above a heading. */
export function Eyebrow({ children, centered = false, leading, className }: EyebrowProps) {
  const rule = <span aria-hidden className="h-px w-8 bg-primary" />;
  return (
    <span className={cn('inline-flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase', className)}>
      {leading ?? rule}
      {children}
      {centered && !leading && rule}
    </span>
  );
}
