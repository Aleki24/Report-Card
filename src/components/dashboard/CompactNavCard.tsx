import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import DashboardCard from './DashboardCard';

type CompactNavCardProps = {
  title: string;
  subtitle: string;
  href: string;
  icon?: React.ReactNode;
  className?: string;
};

export default function CompactNavCard({ title, subtitle, href, icon, className }: CompactNavCardProps) {
  return (
    <Link href={href} className="group block no-underline">
      <DashboardCard hoverable className={cn('flex min-h-[76px] items-center gap-3 px-4 py-3', className)}>
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">{title}</h3>
          <p className="truncate text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
      </DashboardCard>
    </Link>
  );
}
