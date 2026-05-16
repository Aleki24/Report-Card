import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  breadcrumbs?: { label: string; href?: string }[];
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div className="mb-5">
      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
      <div className="flex items-center gap-1.5 mb-2">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            {crumb.href ? (
              <Link href={crumb.href} className="text-[11px] text-muted-foreground no-underline font-medium hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[11px] text-primary font-semibold">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
      )}

      {/* Title Row */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-[22px] font-bold text-foreground tracking-tight mb-1">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
