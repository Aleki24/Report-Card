import React from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { TONES, type Hue } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small label above the title — the menu section, e.g. "Finance". */
  eyebrow?: string;
  /** The page's icon, shown in a gradient tile in the page's colour. */
  icon?: LucideIcon;
  /** The page's colour; each section of the app has its own. */
  hue?: Hue;
  breadcrumbs?: { label: string; href?: string }[];
  action?: React.ReactNode;
  className?: string;
}

/** Every page's title block: one layout, one colour per page, as on Users and Exams & Marks. */
export default function PageHeader({ title, description, eyebrow, icon: Icon, hue = 'blue', breadcrumbs, action, className }: PageHeaderProps) {
  const tone = TONES[hue];
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground" aria-hidden />}
              {crumb.href ? (
                <Link href={crumb.href} className="text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn('text-xs font-semibold', tone.text)} aria-current="page">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {Icon && (
            <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md sm:size-12', tone.gradient)} aria-hidden>
              <Icon className="size-5 sm:size-6" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className={cn('mb-0.5 text-[11px] font-semibold tracking-widest uppercase', tone.text)}>{eyebrow}</p>}
            <h1 className="font-display text-[1.375rem] font-bold tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
            {description && <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="min-w-0 md:shrink-0">{action}</div>}
      </div>
    </header>
  );
}
