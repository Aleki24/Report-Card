"use client";

import { BarChart3 } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      className="relative z-10"
      style={{
        padding: 'clamp(20px, 3vw, 32px) clamp(16px, 5vw, 48px)',
        borderTop: '1px solid var(--color-border-subtle)',
      }}
    >
      <div
        className="flex flex-col sm:flex-row items-center justify-between"
        style={{ maxWidth: '1280px', margin: '0 auto', gap: '24px' }}
      >
        <div className="flex items-center" style={{ gap: '12px' }}>
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
            }}
          >
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontSize: '1.125rem',
              letterSpacing: '-0.01em',
            }}
          >
            Matokeo
          </span>
        </div>

        <span
          style={{
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            letterSpacing: '0.03em',
          }}
        >
          © {new Date().getFullYear()} Matokeo Academic System. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
