import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  breadcrumbs: { label: string; href?: string }[];
  action?: React.ReactNode;
}

export default function PageHeader({ title, description, breadcrumbs, action }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--color-text-muted)' }} />}
            {crumb.href ? (
              <Link href={crumb.href} style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textDecoration: 'none', fontWeight: 500 }}>
                {crumb.label}
              </Link>
            ) : (
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-accent)', fontWeight: 600 }}>{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Title Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '4px',
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </div>
  );
}
