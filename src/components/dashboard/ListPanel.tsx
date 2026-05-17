import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import DashboardCard from './DashboardCard';

type ListPanelProps = {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  children: React.ReactNode;
  className?: string;
};

export default function ListPanel({ title, actionLabel, actionHref, children, className }: ListPanelProps) {
  return (
    <DashboardCard className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {actionLabel && actionHref && (
          <Link href={actionHref} className="inline-flex items-center gap-1 text-xs font-semibold tracking-tight text-primary hover:underline">
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </DashboardCard>
  );
}
