"use client";

import { BookOpen, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function RolesSection() {
  const { theme } = useTheme();

  const adminFeatures = [
    'School Structure & Grading Config',
    'Global Insights & Analytics',
    'User & Role Management',
  ];

  const teacherFeatures = [
    'Hassle-Free Marks Input',
    'Generate Broadsheets & Reports',
    'Class Performance Overview',
  ];

  return (
    <section className="relative" style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)' }}>
      <div
        className="absolute inset-0"
        style={{
          background: theme === 'dark'
            ? 'linear-gradient(180deg, var(--color-bg), var(--color-surface) 20%, var(--color-surface) 80%, var(--color-bg))'
            : 'linear-gradient(180deg, var(--color-bg), var(--color-surface-raised) 20%, var(--color-surface-raised) 80%, var(--color-bg))',
        }}
      />

      <div className="relative z-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Section Header — Centered mobile, right-aligned desktop */}
        <div className="flex flex-col items-center text-center lg:items-end lg:text-right" style={{ marginBottom: 'clamp(32px, 4vw, 56px)', maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}>
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
              marginBottom: '16px',
            }}
          >
            Role-Based Access
            <span style={{ width: '32px', height: '1px', background: 'var(--color-accent)', display: 'inline-block' }} />
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(1.75rem, 4vw, 3.2rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
              marginBottom: '24px',
              wordSpacing: '0.02em',
            }}
          >
            Dedicated Portals,{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Tailored Experience</span>
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(0.9375rem, 1.6vw, 1.125rem)',
              lineHeight: 1.7,
              maxWidth: '480px',
              letterSpacing: '0.01em',
              wordSpacing: '0.02em',
            }}
          >
            Matokeo intelligently scopes access and tools to match each user&apos;s responsibilities.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid sm:grid-cols-2" style={{ gap: 'clamp(16px, 2vw, 24px)', maxWidth: '1024px', margin: '0 auto' }}>
          {/* Administrator */}
          <div
            className="group relative rounded-2xl border transition-all duration-500 hover:border-[var(--color-accent)]"
            style={{
              padding: 'clamp(24px, 4vw, 40px)',
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border-subtle)',
              boxShadow: theme === 'dark' ? '0 8px 40px rgba(0,0,0,0.3)' : '0 8px 40px rgba(0,0,0,0.06)',
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: '56px',
                height: '56px',
                marginBottom: '32px',
                background: 'var(--color-accent-glow)',
                border: '1px solid rgba(212, 168, 83, 0.15)',
              }}
            >
              <ShieldCheck className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            </div>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}
            >
              Full Control
            </span>
            <h3
              style={{
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
                fontWeight: 700,
                marginTop: '8px',
                marginBottom: '16px',
                letterSpacing: '-0.01em',
              }}
            >
              Administrator
            </h3>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                marginBottom: '32px',
                letterSpacing: '0.01em',
                wordSpacing: '0.02em',
              }}
            >
              Complete academic oversight, user management, and system-wide configurations from a single command center.
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {adminFeatures.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    gap: '12px',
                    letterSpacing: '0.01em',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-accent)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Teachers */}
          <div
            className="group relative rounded-2xl border transition-all duration-500 hover:border-[var(--color-success)]"
            style={{
              padding: 'clamp(24px, 4vw, 40px)',
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border-subtle)',
              boxShadow: theme === 'dark' ? '0 8px 40px rgba(0,0,0,0.3)' : '0 8px 40px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex" style={{ gap: '12px', marginBottom: '32px' }}>
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'rgba(92, 184, 122, 0.1)',
                  border: '1px solid rgba(92, 184, 122, 0.15)',
                }}
              >
                <BookOpen className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
              </div>
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: '56px',
                  height: '56px',
                  background: 'rgba(159, 122, 234, 0.1)',
                  border: '1px solid rgba(159, 122, 234, 0.15)',
                }}
              >
                <Users className="w-6 h-6" style={{ color: 'var(--color-purple-500)' }} />
              </div>
            </div>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}
            >
              Streamlined Input
            </span>
            <h3
              style={{
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
                fontWeight: 700,
                marginTop: '8px',
                marginBottom: '16px',
                letterSpacing: '-0.01em',
              }}
            >
              Teachers
            </h3>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                marginBottom: '32px',
                letterSpacing: '0.01em',
                wordSpacing: '0.02em',
              }}
            >
              Dedicated interface for rapid exam score entry and comprehensive class management tools.
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {teacherFeatures.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    gap: '12px',
                    letterSpacing: '0.01em',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-success)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
