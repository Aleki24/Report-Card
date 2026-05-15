import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, trend }: StatCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div
        className="stat-card-icon"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: iconBg || 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: '24px', height: '24px', color: iconColor || '#ffffff' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            fontWeight: 600,
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {(sub || trend) && (
          <div style={{ fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            {trend && (
              <span style={{ color: trend.positive ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {sub && !trend && <span style={{ color: sub.includes('overdue') ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
