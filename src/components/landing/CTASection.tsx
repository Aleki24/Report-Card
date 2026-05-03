"use client";

import Link from 'next/link';
import { ArrowRight, Award } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function CTASection() {
  const { theme } = useTheme();

  return (
    <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          border: '1px solid var(--color-border)',
          boxShadow: theme === 'dark'
            ? '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)'
            : '0 32px 80px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(135deg, #1E1D1B 0%, #161514 40%, #0D0C0B 100%)'
              : 'linear-gradient(135deg, #FFFFFF 0%, #FAF8F5 40%, #F5F2EE 100%)',
          }}
        />
        <div
          className="absolute top-0 left-0 w-full h-full z-0"
          style={{
            background: 'radial-gradient(ellipse at top left, var(--color-accent-glow), transparent 60%)',
            opacity: 0.8,
          }}
        />
        <div
          className="absolute top-0 right-0 z-0"
          style={{
            width: '1px',
            height: '100%',
            transform: 'rotate(12deg)',
            transformOrigin: 'top',
            background: 'linear-gradient(to bottom, var(--color-accent), transparent)',
            opacity: 0.15,
          }}
        />

        <div className="relative z-10 text-center" style={{ padding: 'clamp(32px, 5vw, 72px) clamp(24px, 4vw, 64px)' }}>
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <span
              className="inline-flex items-center"
              style={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                gap: '8px',
                marginBottom: '24px',
              }}
            >
              <Award className="w-4 h-4" />
              Ready to Begin
            </span>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(1.75rem, 4.5vw, 3.5rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
                marginBottom: '24px',
                wordSpacing: '0.02em',
              }}
            >
              Streamline Your{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Academic Processing</span>
            </h2>

            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(0.9375rem, 1.6vw, 1.125rem)',
                lineHeight: 1.7,
                marginBottom: '40px',
                maxWidth: '540px',
                margin: '0 auto 40px',
                letterSpacing: '0.01em',
                wordSpacing: '0.02em',
              }}
            >
              Configure your school structure, manage grades securely, and generate comprehensive reports — all from a single dashboard.
            </p>

            <Link
              href="/dashboard"
              className="group inline-flex items-center rounded-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                color: '#1A1816',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '1rem',
                padding: 'clamp(14px, 2vw, 16px) clamp(28px, 3vw, 32px)',
                gap: '12px',
                letterSpacing: '0.01em',
                boxShadow: '0 4px 30px rgba(212, 168, 83, 0.35)',
              }}
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
