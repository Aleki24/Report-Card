import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface KpiTileProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  href: string;
  /** Tint the icon chip with the destructive color to flag an alert metric. */
  alert?: boolean;
}

export default function KpiTile({ title, value, icon, href, alert = false }: KpiTileProps) {
  return (
    <Link href={href} className="group block no-underline">
      <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:p-4">
        <div className="flex items-start justify-between">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${alert ? 'bg-destructive/15 text-destructive' : 'bg-primary/12 text-primary'}`}>
            {icon}
          </div>
          <ArrowUpRight size={14} className="text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>
        <div className="mt-3 text-xl font-bold leading-none tracking-tight text-foreground sm:text-2xl">{value}</div>
        <div className="mt-1.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{title}</div>
      </div>
    </Link>
  );
}
