import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TONES, type Hue } from './tones';
import { cn } from '@/lib/utils';

interface CardHeadingProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  hue?: Hue;
  action?: React.ReactNode;
  /** Heading level for the document outline; defaults to h3 (inside a page's h1). */
  as?: 'h2' | 'h3';
  className?: string;
}

/** A card's title with a tinted icon tile, in place of an emoji. */
export function CardHeading({ icon: Icon, title, description, hue = 'blue', action, as: Tag = 'h3', className }: CardHeadingProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', TONES[hue].tile)} aria-hidden>
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <Tag className="font-display text-base font-bold leading-tight text-foreground">{title}</Tag>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
