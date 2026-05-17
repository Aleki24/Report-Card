import React from 'react';
import type { LucideIcon } from 'lucide-react';
import DashboardCard from './DashboardCard';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({ label, value, sub, icon: Icon, iconClassName, trend }: StatCardProps) {
  return (
    <DashboardCard hoverable className="flex h-full items-center gap-4">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:h-11 sm:w-11',
          iconClassName || 'bg-primary/15 text-primary'
        )}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold tracking-tight text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xl font-bold leading-none tracking-tight text-foreground sm:text-2xl">
          {value}
        </div>
        {(sub || trend) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium leading-relaxed">
            {trend && (
              <span className={cn('font-semibold', trend.positive ? 'text-primary' : 'text-destructive')}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {sub && !trend && (
              <span className={sub.includes('overdue') ? 'text-destructive' : 'text-muted-foreground'}>
                {sub}
              </span>
            )}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
