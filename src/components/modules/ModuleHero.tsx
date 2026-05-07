import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { Module } from '@/lib/modules';

interface ModuleHeroProps {
  module: Module;
}

export default function ModuleHero({ module }: ModuleHeroProps) {
  const IconComponent = module.icon;

  return (
    <section style={{ padding: 'clamp(112px, 12vw, 152px) clamp(16px, 5vw, 48px) clamp(48px, 6vw, 80px)' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto', textAlign: 'center' }}>
        {/* Icon Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-accent-glow)',
            border: '1px solid var(--color-accent)',
            marginBottom: '24px',
          }}
        >
          <IconComponent style={{ width: '28px', height: '28px', color: 'var(--color-accent)' }} />
        </div>

        {/* Editorial Label */}
        <div style={{ marginBottom: '16px' }}>
          <span
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
            }}
          >
            Matokeo Module
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(1.75rem, 4.5vw, 3.5rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
            marginBottom: '24px',
          }}
        >
          {module.title}
        </h1>

        {/* Long Description */}
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
            lineHeight: 1.7,
            maxWidth: '640px',
            margin: '0 auto 32px',
            letterSpacing: '0.01em',
          }}
        >
          {module.longDescription}
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
          <Link
            href={module.dashboardHref}
            className="group"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: 'clamp(10px, 1.5vw, 12px) clamp(18px, 2.5vw, 24px)',
              borderRadius: '12px',
              background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
              color: '#1A1816',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.875rem',
              letterSpacing: '0.01em',
              textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(212, 168, 83, 0.3)',
              transition: 'all 0.3s ease',
            }}
          >
            Open {module.shortTitle} Dashboard
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </Link>
          <Link
            href="/features"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: 'clamp(10px, 1.5vw, 12px) clamp(18px, 2.5vw, 24px)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: '0.875rem',
              letterSpacing: '0.01em',
              textDecoration: 'none',
              background: 'transparent',
              transition: 'all 0.3s ease',
            }}
          >
            All Features
            <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--color-text-muted)' }} />
          </Link>
        </div>
      </div>
    </section>
  );
}
