"use client";

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Award, ChevronRight } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function CTASection() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      <div
        className="relative rounded-3xl overflow-hidden scroll-reveal"
        style={{
          border: '1px solid var(--color-border)',
          boxShadow: isDark
            ? '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)'
            : '0 32px 80px rgba(0,0,0,0.06)',
        }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            background: isDark
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

        {/* Decorative floating assets */}
        <div
          className="absolute rounded-2xl overflow-hidden animate-float hidden lg:block z-0"
          style={{
            top: '-28px',
            right: '4%',
            width: '148px',
            height: '148px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            transform: 'rotate(8deg)',
            opacity: 0.9,
          }}
        >
          <Image
            src="/images/empty_state.png"
            alt="Holographic school records folder"
            fill
            sizes="148px"
            style={{ objectFit: 'cover' }}
          />
        </div>
        <div
          className="absolute rounded-2xl overflow-hidden animate-float hidden lg:block z-0"
          style={{
            bottom: '-32px',
            left: '5%',
            width: '124px',
            height: '124px',
            border: '1px solid var(--color-border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            transform: 'rotate(-7deg)',
            opacity: 0.85,
            animationDelay: '2s',
          }}
        >
          <Image
            src="/images/dashboard_hero.png"
            alt="Abstract glass geometric shapes"
            fill
            sizes="124px"
            style={{ objectFit: 'cover' }}
          />
        </div>

        <div className="relative z-10 text-center" style={{ padding: 'clamp(40px, 6vw, 88px) clamp(24px, 4vw, 64px)' }}>
          <div style={{ maxWidth: '660px', margin: '0 auto' }}>
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
              Ready When You Are
            </span>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(1.625rem, 3.8vw, 3rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
                marginBottom: '20px',
              }}
            >
              This term, run your whole school{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>from one dashboard</span>
            </h2>

            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(0.875rem, 1.4vw, 1.0625rem)',
                lineHeight: 1.7,
                maxWidth: '540px',
                margin: '0 auto 36px',
                letterSpacing: '0.01em',
              }}
            >
              Set up your school with the guided wizard, invite staff and students with
              one-time codes, and manage people, exams, attendance, report cards and
              parent updates in one place — no more scattered spreadsheets.
            </p>

            <div className="flex flex-col sm:flex-row justify-center" style={{ gap: '16px' }}>
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                  color: 'var(--primary-foreground)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  padding: '13px 28px',
                  gap: '12px',
                  letterSpacing: '0.01em',
                  boxShadow: '0 8px 32px var(--color-accent-glow), 0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                Register Your School — Free
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/activate"
                className="group inline-flex items-center justify-center rounded-xl transition-all duration-300 hover:border-primary"
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  padding: '13px 28px',
                  gap: '12px',
                  background: 'transparent',
                }}
              >
                Join with Invite Code
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
