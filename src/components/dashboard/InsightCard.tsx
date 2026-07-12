import React from 'react';
import Link from 'next/link';

interface InsightCardProps {
  title: string;
  /** Small muted text on the right of the header (e.g. "Current term"). */
  meta?: string;
  /** Link action on the right of the header; takes precedence over meta. */
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}

export default function InsightCard({ title, meta, action, children, className }: InsightCardProps) {
  return (
    <div className={`rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm xs:p-5 ${className ?? ''}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {action ? (
          <Link href={action.href} className="text-xs font-medium text-primary hover:underline">{action.label}</Link>
        ) : meta ? (
          <span className="text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
