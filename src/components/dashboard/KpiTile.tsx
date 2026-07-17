import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'blue' | 'green' | 'purple' | 'red';

interface KpiTileProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  href: string;
  /** Tint the icon chip with the destructive color to flag an alert metric. */
  alert?: boolean;
  /** Render as a bold color card instead of the neutral surface, for a scannable overview grid. */
  tone?: Tone;
}

const TONE_BG: Record<Tone, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  purple: 'bg-violet-500',
  red: 'bg-red-600',
};

export default function KpiTile({ title, value, icon, href, alert = false, tone }: KpiTileProps) {
  return (
    <Link href={href} className="group block no-underline">
      <div
        className={cn(
          'flex h-full flex-col rounded-2xl p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4',
          tone ? TONE_BG[tone] : 'border border-border/60 bg-card/90 hover:border-primary/50'
        )}
      >
        <div className="flex items-start justify-between">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9',
              tone ? 'bg-white/20 text-white' : alert ? 'bg-destructive/15 text-destructive' : 'bg-primary/12 text-primary'
            )}
          >
            {icon}
          </div>
          <ArrowUpRight size={14} className={cn('opacity-0 transition-opacity duration-200 group-hover:opacity-100', tone ? 'text-white/70' : 'text-muted-foreground')} />
        </div>
        <div className={cn('mt-3 text-xl font-bold leading-none tracking-tight sm:text-2xl', tone ? 'text-white' : 'text-foreground')}>{value}</div>
        <div className={cn('mt-1.5 truncate text-[11px] font-medium sm:text-xs', tone ? 'text-white/80' : 'text-muted-foreground')}>{title}</div>
      </div>
    </Link>
  );
}
