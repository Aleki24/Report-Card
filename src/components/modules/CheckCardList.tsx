import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES, type Tone } from '@/components/landing/ui/tones';

type CheckCardListProps = {
  items: string[];
  tone?: Tone;
  /** Two columns from md up, or a single readable column. */
  columns?: 1 | 2;
};

/** A list of statements, each on its own card with a tick — features and benefits. */
export default function CheckCardList({ items, tone = 'primary', columns = 2 }: CheckCardListProps) {
  return (
    <ul className={cn('mx-auto grid gap-3 md:gap-4', columns === 2 ? 'max-w-4xl md:grid-cols-2' : 'max-w-2xl')}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3.5 rounded-xl border border-border bg-card px-5 py-4 transition-colors duration-300 hover:border-primary/40">
          <CheckCircle2 className={cn('mt-0.5 size-5 shrink-0', TONES[tone].text)} aria-hidden />
          <span className="text-sm leading-relaxed text-muted-foreground md:text-base">{item}</span>
        </li>
      ))}
    </ul>
  );
}
