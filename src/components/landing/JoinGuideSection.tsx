"use client";

import Link from 'next/link';
import { ArrowRight, School, BookOpen, GraduationCap, KeyRound, UserPlus, LogIn } from 'lucide-react';

const paths = [
  {
    icon: School,
    audience: 'School Administrators',
    title: 'Register Your School',
    color: 'var(--color-accent)',
    steps: [
      'Create a free account with your email or Google',
      'Complete the guided setup — school details, calendar, classes and subjects',
      'Invite your teachers and students with one-time invite codes',
    ],
    ctaLabel: 'Create School Account',
    ctaHref: '/signup',
  },
  {
    icon: BookOpen,
    audience: 'Teachers',
    title: 'Join with an Invite Code',
    color: 'var(--color-success)',
    steps: [
      'Ask your school administrator for your 6-character invite code',
      'Activate your account once — with Google or a username & password',
      'Sign in to manage your classes, marks and report cards',
    ],
    ctaLabel: 'Activate Your Account',
    ctaHref: '/activate',
  },
  {
    icon: GraduationCap,
    audience: 'Students',
    title: 'Activate Your Portal',
    color: 'var(--color-purple-500, #9F7AEA)',
    steps: [
      'Get your personal invite code from your school',
      'Activate your account once — no second code needed later',
      'View your marks, report cards and progress anytime',
    ],
    ctaLabel: 'Activate Your Account',
    ctaHref: '/activate',
  },
];

export default function JoinGuideSection() {
  return (
    <>
      {/* ===== HORIZONTAL DIVIDER WITH LABEL ===== */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 clamp(16px, 5vw, 48px)' }}>
        <div className="flex items-center" style={{ gap: '24px' }}>
          <div className="flex-1" style={{ height: '1px', background: 'var(--color-border-subtle)' }} />
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.6875rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
            }}
          >
            Getting Started
          </span>
          <div className="flex-1" style={{ height: '1px', background: 'var(--color-border-subtle)' }} />
        </div>
      </div>

      {/* ===== JOIN GUIDE SECTION ===== */}
      <section id="how-to-join" style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
        {/* Section Header */}
        <div className="text-center lg:text-left" style={{ maxWidth: '640px', marginBottom: 'clamp(32px, 4vw, 56px)', marginLeft: 'auto', marginRight: 'auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(1.5rem, 3.5vw, 2.75rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
              marginBottom: '24px',
              wordSpacing: '0.02em',
            }}
          >
            How to{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
              Join the Program
            </span>
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(0.875rem, 1.4vw, 1rem)',
              lineHeight: 1.7,
              maxWidth: '540px',
              letterSpacing: '0.01em',
              wordSpacing: '0.02em',
            }}
          >
            Whether you run a school or belong to one, getting on Matokeo takes just a few minutes. Pick the path that matches you.
          </p>
        </div>

        {/* Join Paths */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'clamp(16px, 2vw, 24px)' }}>
          {paths.map((path, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl border transition-all duration-500 hover:border-primary hover:shadow-lg flex flex-col"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border-subtle)',
                padding: 'clamp(24px, 3vw, 32px)',
              }}
            >
              {/* Icon + audience */}
              <div className="flex items-center" style={{ gap: '14px', marginBottom: '20px' }}>
                <div
                  className="flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: `color-mix(in srgb, ${path.color} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${path.color} 15%, transparent)`,
                    flexShrink: 0,
                  }}
                >
                  <path.icon className="w-5 h-5" style={{ color: path.color }} />
                </div>
                <div>
                  <div
                    style={{
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      marginBottom: '2px',
                    }}
                  >
                    {path.audience}
                  </div>
                  <h3
                    style={{
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1rem, 1.6vw, 1.125rem)',
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {path.title}
                  </h3>
                </div>
              </div>

              {/* Steps */}
              <ol className="flex-1" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {path.steps.map((step, stepIdx) => (
                  <li key={stepIdx} className="flex items-start" style={{ gap: '12px' }}>
                    <span
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: '20px',
                        height: '20px',
                        flexShrink: 0,
                        marginTop: '1px',
                        background: `color-mix(in srgb, ${path.color} 10%, transparent)`,
                        color: path.color,
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                      }}
                    >
                      {stepIdx + 1}
                    </span>
                    <span
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.8125rem',
                        lineHeight: 1.6,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              {/* CTA */}
              <Link
                href={path.ctaHref}
                className="inline-flex items-center justify-center rounded-xl transition-all duration-300 hover:opacity-90"
                style={{
                  border: `1px solid color-mix(in srgb, ${path.color} 30%, transparent)`,
                  color: path.color,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  padding: '10px 18px',
                  gap: '10px',
                  letterSpacing: '0.01em',
                }}
              >
                {path.ctaLabel}
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  height: '2px',
                  borderRadius: '0 0 16px 16px',
                  background: `linear-gradient(90deg, ${path.color}, transparent)`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Quick links strip */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center rounded-2xl border"
          style={{
            marginTop: 'clamp(24px, 3vw, 40px)',
            padding: 'clamp(16px, 2.5vw, 24px)',
            gap: 'clamp(12px, 2vw, 32px)',
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border-subtle)',
          }}
        >
          {[
            { icon: UserPlus, label: 'New school?', linkLabel: 'Register free', href: '/signup' },
            { icon: KeyRound, label: 'Have an invite code?', linkLabel: 'Activate account', href: '/activate' },
            { icon: LogIn, label: 'Already activated?', linkLabel: 'Sign in', href: '/login' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center" style={{ gap: '8px' }}>
              <item.icon className="w-4 h-4" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  letterSpacing: '0.01em',
                }}
              >
                {item.label}
              </span>
              <Link
                href={item.href}
                className="inline-flex items-center transition-opacity hover:opacity-80"
                style={{
                  color: 'var(--color-accent)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                {item.linkLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
