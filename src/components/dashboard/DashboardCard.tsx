import React from 'react';
import { cn } from '@/lib/utils';

type DashboardCardProps = {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
};

export default function DashboardCard({ children, className, hoverable = false }: DashboardCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-card/90 px-8 py-6 shadow-sm backdrop-blur-sm',
        'transition-all duration-200',
        hoverable && 'hover:-translate-y-px hover:border-primary/50 hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}
