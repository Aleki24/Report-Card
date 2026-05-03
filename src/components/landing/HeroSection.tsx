"use client";

import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function HeroSection() {
  const { theme } = useTheme();

  return (
    <section style={{ padding: 'clamp(32px, 5vw, 72px) clamp(16px, 5vw, 48px) clamp(48px, 6vw, 96px)' }}>
      <div className="grid lg:grid-cols-12 items-center" style={{ maxWidth: '1280px', margin: '0 auto', gap: 'clamp(24px, 3vw, 48px)' }}>
        {/* Left Column — Text */}
        <div className="lg:col-span-7 text-center lg:text-left items-center lg:items-start" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2.5vw, 24px)' }}>
          {/* Editorial Label */}
          <div>
            <span
              className="inline-flex items-center"
              style={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                gap: '10px',
              }}
            >
              <span
                style={{ width: '32px', height: '1px', background: 'var(--color-accent)', display: 'inline-block' }}
              />
              Academic Intelligence Platform
            </span>
          </div>

          {/* Main Headline */}
          <h1

            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(1.75rem, 4.5vw, 4rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
              wordSpacing: '0.02em',
            }}
          >
            Where Every Mark{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
              Tells a Story
            </span>
          </h1>

          {/* Subtext */}
          <p

            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
              lineHeight: 1.7,
              maxWidth: '560px',
              letterSpacing: '0.01em',
              wordSpacing: '0.02em',
            }}
          >
            Matokeo transforms raw exam data into comprehensive, beautifully formatted report cards —
            automating calculations, rankings, and insights for thousands of students in moments.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row" style={{ gap: '16px', paddingTop: '8px' }}>
            <Link
              href="/dashboard"
              className="group inline-flex items-center rounded-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                color: '#1A1816',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.875rem',
                padding: 'clamp(10px, 1.5vw, 12px) clamp(18px, 2.5vw, 22px)',
                gap: '12px',
                letterSpacing: '0.01em',
                boxShadow: '0 4px 24px rgba(212, 168, 83, 0.3)',
              }}
            >
              Open Dashboard
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="group inline-flex items-center rounded-xl transition-all duration-300 hover:border-[var(--color-accent)]"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: '0.875rem',
                padding: 'clamp(10px, 1.5vw, 12px) clamp(18px, 2.5vw, 22px)',
                gap: '12px',
                background: 'transparent',
                letterSpacing: '0.01em',
              }}
            >
              Login to Portal
              <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" style={{ color: 'var(--color-text-muted)' }} />
            </Link>
          </div>
        </div>

        {/* Right Column — Decorative Stats Panel */}
        <div className="lg:col-span-5 relative">
          <div className="relative">
            {/* Background decorative element */}
            <div
              className="absolute rounded-3xl"
              style={{
                inset: '-16px',
                transform: 'rotate(2deg)',
                background: 'linear-gradient(145deg, var(--color-accent-glow), transparent)',
                border: '1px solid var(--color-border-subtle)',
              }}
            />
            {/* Main card */}
            <div
              className="relative rounded-2xl backdrop-blur-sm"
              style={{
                padding: 'clamp(24px, 3vw, 32px)',
                background: theme === 'dark'
                  ? 'rgba(22, 21, 20, 0.85)'
                  : 'rgba(255, 255, 255, 0.85)',
                border: '1px solid var(--color-border)',
                boxShadow: theme === 'dark'
                  ? '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)'
                  : '0 24px 80px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              {/* Mini label */}
              <div className="flex items-center" style={{ gap: '8px', marginBottom: '24px' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                <span
                  style={{
                    color: 'var(--color-accent)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                  }}
                >
                  Platform Highlights
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2" style={{ gap: 'clamp(12px, 2vw, 16px)' }}>
                {[
                  { icon: ShieldCheck, label: 'Role-Based', sub: 'Secure Access', color: 'var(--color-accent)' },
                  { icon: Zap, label: 'Real-Time', sub: 'Auto Calculations', color: 'var(--color-success)' },
                  { icon: FileText, label: 'PDF Export', sub: 'Report Cards', color: 'var(--color-warning)' },
                  { icon: TrendingUp, label: 'Analytics', sub: 'Deep Insights', color: 'var(--color-purple-500)' },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      padding: 'clamp(12px, 2vw, 16px)',
                      background: theme === 'dark'
                        ? 'rgba(30, 29, 27, 0.6)'
                        : 'rgba(245, 242, 238, 0.6)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <stat.icon className="w-5 h-5" style={{ color: stat.color, marginBottom: '12px' }} />
                    <div
                      style={{
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        marginBottom: '2px',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      style={{
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.6875rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {stat.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom shimmer line */}
              <div
                style={{
                  marginTop: '24px',
                  height: '1px',
                  width: '100%',
                  borderRadius: '9999px',
                  background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
                  backgroundSize: '200% 100%',

                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
