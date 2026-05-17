import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type DashboardSectionProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  children: React.ReactNode;
};

export default function DashboardSection({ title, description, actionLabel, actionHref, children }: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium tracking-tight text-primary transition-all duration-200 hover:-translate-y-px hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
