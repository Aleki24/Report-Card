import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import DashboardCard from './DashboardCard';

type PrimaryActionCardProps = {
  title: string;
  description: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
};

export default function PrimaryActionCard({ title, description, href, icon, badge }: PrimaryActionCardProps) {
  return (
    <Link href={href} className="group block h-full no-underline">
      <DashboardCard hoverable className="flex h-full min-h-[132px] flex-col justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
            {icon}
          </div>
          {badge && (
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-tight text-primary">
              {badge}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">{title}</h3>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </DashboardCard>
    </Link>
  );
}
