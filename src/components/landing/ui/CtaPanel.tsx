import type { ReactNode } from 'react';
import { Award } from 'lucide-react';
import { Eyebrow, Section } from './Section';

type CtaPanelProps = {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  /** Trailing words of the title in the italic accent treatment. */
  highlight?: string;
  description: ReactNode;
  actions: ReactNode;
  /** Small print under the buttons, e.g. the price. */
  footnote?: ReactNode;
  /** Decorative layers positioned inside the card (absolute). */
  decoration?: ReactNode;
};

/** The closing call-to-action card used at the foot of marketing pages. */
export function CtaPanel({ id, eyebrow, title, highlight, description, actions, footnote, decoration }: CtaPanelProps) {
  return (
    <Section id={id}>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-background shadow-2xl shadow-black/5 dark:shadow-black/50">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-accent-glow),transparent_60%)]" />
        {decoration}

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-12 text-center md:px-12 md:py-20">
          <Eyebrow leading={<Award className="size-4" aria-hidden />}>{eyebrow}</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {title}
            {highlight && (
              <>
                {' '}
                <span className="text-primary italic">{highlight}</span>
              </>
            )}
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">{description}</p>
          <div className="mt-4 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">{actions}</div>
          {footnote && <p className="text-sm text-muted-foreground">{footnote}</p>}
        </div>
      </div>
    </Section>
  );
}
