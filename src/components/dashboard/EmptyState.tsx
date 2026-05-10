import React from 'react';
import { Users } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: 'var(--color-text-muted)',
        }}
      >
        {icon || <Users style={{ width: '24px', height: '24px' }} />}
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: '6px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
          maxWidth: '320px',
          marginBottom: action ? '16px' : '0',
        }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}
