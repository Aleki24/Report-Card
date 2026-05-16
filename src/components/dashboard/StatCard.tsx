import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';

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
    <Card className="flex items-center gap-6 p-8 py-8 hover:border-primary transition-all duration-200 group h-full">
      <div
        className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${iconClassName || 'bg-primary/15 text-primary'}`}
      >
        <Icon className="w-7 h-7" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="text-sm text-muted-foreground font-semibold mb-1">
          {label}
        </div>
        <div className="font-sans text-3xl font-bold text-foreground leading-none">
          {value}
        </div>
        {(sub || trend) && (
          <div className="text-[13px] mt-2 flex items-center gap-1.5 font-medium">
            {trend && (
              <span className={`font-semibold ${trend.positive ? 'text-primary' : 'text-destructive'}`}>
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
    </Card>
  );
}
