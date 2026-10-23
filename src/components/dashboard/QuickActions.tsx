import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hueForHref } from '@/components/ui/pageHues';
import { TONES } from '@/components/ui/tones';
import { AUTO_FIT_GRID } from './grid';

export interface QuickActionItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line under the label; shown from the `sm` breakpoint up. */
  desc?: string;
}

/** A row of shortcut tiles, each tinted by the page it opens. */
export function QuickActions({ items }: { items: readonly QuickActionItem[] }) {
  return (
    <ul className={cn(AUTO_FIT_GRID.tile, 'gap-2')}>
      {items.map(({ label, href, icon: Icon, desc }) => {
        const tone = TONES[hueForHref(href)];
        return (
          <li key={label} className="min-w-0">
            <Link href={href} className={cn('group flex h-full items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md xl:flex-col xl:items-start xl:gap-2 xl:py-3', tone.hover)}>
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone.tile)} aria-hidden><Icon className="size-4" /></span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight text-foreground sm:text-sm">{label}</span>
                {desc && <span className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">{desc}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
