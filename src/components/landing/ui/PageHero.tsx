import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Eyebrow } from './Section';

type PageHeroProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  /** Trailing words of the title in the italic accent treatment. */
  highlight?: string;
  description: ReactNode;
  icon?: LucideIcon;
  /** Buttons under the description. */
  actions?: ReactNode;
};

/** The opening block of an inner marketing page — clears the fixed navbar. */
export function PageHero({ eyebrow, title, highlight, description, icon: Icon, actions }: PageHeroProps) {
  return (
    <section className="px-4 pt-28 pb-12 sm:px-6 md:pt-36 md:pb-20 lg:px-12">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        {Icon && (
          <span className="flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Icon className="size-7" aria-hidden />
          </span>
        )}
        <Eyebrow centered>{eyebrow}</Eyebrow>
        <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {title}
          {highlight && (
            <>
              {' '}
              <span className="text-primary italic">{highlight}</span>
            </>
          )}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
        {actions && <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">{actions}</div>}
      </div>
    </section>
  );
}
