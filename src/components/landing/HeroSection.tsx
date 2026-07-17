"use client";

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquareText,
  Smartphone,
  Upload,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

const TRUST_CHIPS = [
  { icon: CheckCircle2, label: 'CBC & 8-4-4 grading' },
  { icon: FileText, label: 'PDF report cards' },
  { icon: Smartphone, label: 'Results by SMS' },
  { icon: Upload, label: 'Bulk student import' },
];

const STATS = [
  { value: '10+', label: 'Modules on one platform' },
  { value: '2', label: 'Curricula — CBC & 8-4-4' },
  { value: '4', label: 'Role-based portals' },
  { value: '1', label: 'Invite code to join' },
];

const MOCK_MARKS = [
  { subject: 'Mathematics', score: 84, grade: 'A' },
  { subject: 'English', score: 76, grade: 'B+' },
  { subject: 'Kiswahili', score: 81, grade: 'A-' },
  { subject: 'Int. Science', score: 88, grade: 'A' },
  { subject: 'Social Studies', score: 72, grade: 'B' },
];

export default function HeroSection() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <section style={{ padding: 'clamp(104px, 11vw, 144px) clamp(16px, 5vw, 48px) clamp(40px, 5vw, 72px)' }}>
      <div
        className="grid lg:grid-cols-12 items-center"
        style={{ maxWidth: '1280px', margin: '0 auto', gap: 'clamp(40px, 4vw, 56px)' }}
      >
        {/* ============ LEFT — COPY ============ */}
        <div
          className="lg:col-span-6 text-center lg:text-left items-center lg:items-start animate-fade-in-up"
          style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2.5vw, 24px)' }}
        >
          {/* Kicker */}
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
            <span style={{ width: '32px', height: '1px', background: 'var(--color-accent)', display: 'inline-block' }} />
            Built for Kenyan Schools
          </span>

          {/* Headline */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(2rem, 4.8vw, 4.25rem)',
              lineHeight: 1.06,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
            }}
          >
            Marks in.{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
              Report cards out.
            </span>{' '}
            Parents in the loop.
          </h1>

          {/* Subtext */}
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
              lineHeight: 1.7,
              maxWidth: '540px',
              letterSpacing: '0.01em',
            }}
          >
            Matokeo turns end-of-term chaos into a same-day job. Enter marks once —
            get CBC and 8-4-4 grading, ranked class lists, polished PDF report cards,
            and results delivered to parents by SMS.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row" style={{ gap: '14px', paddingTop: '4px' }}>
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center rounded-xl transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                color: 'var(--primary-foreground)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.9375rem',
                padding: '13px 26px',
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
                padding: '13px 26px',
                gap: '10px',
                background: 'var(--color-surface)',
                letterSpacing: '0.01em',
              }}
            >
              I Have an Invite Code
              <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" style={{ color: 'var(--color-text-muted)' }} />
            </Link>
          </div>

          {/* Trust chips */}
          <div
            className="flex flex-wrap justify-center lg:justify-start"
            style={{ gap: '8px', paddingTop: '8px' }}
          >
            {TRUST_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center rounded-full"
                style={{
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <chip.icon className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                {chip.label}
              </span>
            ))}
          </div>
        </div>

        {/* ============ RIGHT — PRODUCT MOCK ============ */}
        <div className="lg:col-span-6 relative animate-scale-in animation-delay-200" style={{ padding: '24px 0' }}>
          {/* Glow behind the mock */}
          <div
            className="absolute rounded-full blur-[100px] pointer-events-none"
            style={{
              inset: '10%',
              background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)',
              opacity: isDark ? 0.9 : 0.6,
            }}
          />

          {/* Floating 3D asset — glass grade report */}
          <div
            className="absolute rounded-2xl overflow-hidden animate-float hidden sm:block"
            style={{
              top: '-12px',
              right: '-8px',
              width: 'clamp(96px, 10vw, 136px)',
              height: 'clamp(96px, 10vw, 136px)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              transform: 'rotate(6deg)',
              zIndex: 3,
            }}
          >
            <Image
              src="/images/dashboard_marks_icon.png"
              alt="Glass grade report illustration"
              fill
              sizes="136px"
              style={{ objectFit: 'cover' }}
            />
          </div>

          {/* Main mockup card — a marks panel */}
          <div
            className="relative rounded-2xl backdrop-blur-sm"
            style={{
              zIndex: 2,
              background: isDark ? 'rgba(22, 21, 20, 0.9)' : 'rgba(255, 255, 255, 0.92)',
              border: '1px solid var(--color-border)',
              boxShadow: isDark
                ? '0 32px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)'
                : '0 32px 90px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Mock header */}
            <div
              className="flex items-center justify-between flex-wrap"
              style={{
                gap: '8px',
                padding: '16px 20px',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  End-Term Marks — Grade 8 East
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', marginTop: '2px' }}>
                  42 students · 5 subjects entered
                </div>
              </div>
              <span
                className="rounded-full"
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-accent)',
                  background: 'var(--color-accent-glow)',
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                Term 2 · 2026
              </span>
            </div>

            {/* Mock marks rows */}
            <div style={{ padding: '8px 20px' }}>
              {MOCK_MARKS.map((row, idx) => (
                <div
                  key={row.subject}
                  className="flex items-center justify-between"
                  style={{
                    padding: '11px 0',
                    borderBottom: idx < MOCK_MARKS.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                    gap: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      flex: 1,
                    }}
                  >
                    {row.subject}
                  </span>
                  {/* Score bar */}
                  <div
                    className="hidden xs:block rounded-full"
                    style={{ width: '96px', height: '5px', background: 'var(--color-border-subtle)', overflow: 'hidden' }}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: `${row.score}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--color-accent), var(--color-success))',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text-secondary)', width: '32px', textAlign: 'right' }}>
                    {row.score}
                  </span>
                  <span
                    className="rounded-md text-center"
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-success)',
                      background: 'rgba(34, 197, 94, 0.1)',
                      padding: '3px 0',
                      width: '34px',
                    }}
                  >
                    {row.grade}
                  </span>
                </div>
              ))}
            </div>

            {/* Mock footer */}
            <div
              className="flex items-center justify-between flex-wrap"
              style={{
                gap: '10px',
                padding: '14px 20px',
                borderTop: '1px solid var(--color-border-subtle)',
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}
            >
              <div className="flex items-center" style={{ gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Average</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>80.2%</div>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'var(--color-border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rank</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>3 / 42</div>
                </div>
              </div>
              <span
                className="inline-flex items-center rounded-lg"
                style={{
                  gap: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--primary-foreground)',
                  background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                  padding: '8px 14px',
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Report Cards
              </span>
            </div>
          </div>

          {/* Floating chip — report cards ready */}
          <div
            className="absolute rounded-xl backdrop-blur-md animate-float hidden sm:flex items-center"
            style={{
              bottom: '-18px',
              left: '-14px',
              zIndex: 3,
              gap: '10px',
              padding: '12px 16px',
              background: isDark ? 'rgba(22, 21, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              animationDelay: '1.5s',
            }}
          >
            <span
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: '34px', height: '34px', background: 'rgba(34, 197, 94, 0.12)' }}
            >
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            </span>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                42 report cards ready
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                Generated in one click
              </div>
            </div>
          </div>

          {/* Floating chip — SMS sent */}
          <div
            className="absolute rounded-xl backdrop-blur-md animate-float hidden md:flex items-center"
            style={{
              top: '34%',
              left: '-48px',
              zIndex: 3,
              gap: '10px',
              padding: '12px 16px',
              background: isDark ? 'rgba(22, 21, 20, 0.92)' : 'rgba(255, 255, 255, 0.95)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
              animationDelay: '3s',
            }}
          >
            <span
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: '34px', height: '34px', background: 'var(--color-accent-glow)' }}
            >
              <MessageSquareText className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            </span>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                Results sent by SMS
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
                Straight to every parent
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ STATS STRIP ============ */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 animate-fade-in-up animation-delay-400"
        style={{
          maxWidth: '1280px',
          margin: 'clamp(48px, 6vw, 80px) auto 0',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: 'clamp(24px, 3vw, 40px)',
          gap: 'clamp(16px, 3vw, 24px)',
        }}
      >
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center lg:text-left">
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                color: 'var(--color-accent)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
                marginTop: '6px',
                letterSpacing: '0.01em',
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
