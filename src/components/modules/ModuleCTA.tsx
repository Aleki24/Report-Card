import Link from 'next/link';
import { ArrowRight, Award } from 'lucide-react';
import type { Module } from '@/lib/modules';

interface ModuleCTAProps {
  module: Module;
}

export default function ModuleCTA({ module }: ModuleCTAProps) {
  return (
    <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.2)',
        }}
      >
        {/* Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--color-surface)',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(ellipse at top left, var(--color-accent-glow), transparent 60%)',
            opacity: 0.8,
            zIndex: 0,
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: 'clamp(32px, 5vw, 72px) clamp(24px, 4vw, 64px)' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                marginBottom: '24px',
              }}
            >
              <Award style={{ width: '16px', height: '16px' }} />
              Ready to Get Started
            </span>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
                marginBottom: '20px',
              }}
            >
              Start Using{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
                {module.title}
              </span>
            </h2>

            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(0.875rem, 1.4vw, 1rem)',
                lineHeight: 1.7,
                marginBottom: '32px',
                maxWidth: '480px',
                margin: '0 auto 32px',
              }}
            >
              {module.description}
            </p>

            <Link
              href={module.dashboardHref}
              className="group"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 2.5vw, 24px)',
                borderRadius: '12px',
                background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                color: '#1A1816',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.875rem',
                letterSpacing: '0.01em',
                textDecoration: 'none',
                boxShadow: '0 4px 30px rgba(212, 168, 83, 0.35)',
                transition: 'all 0.3s ease',
              }}
            >
              Open {module.shortTitle} Dashboard
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
