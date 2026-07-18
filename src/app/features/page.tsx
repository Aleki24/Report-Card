"use client";

import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { modules, comingSoonModules } from '@/lib/modules';
import { Wordmark } from '@/components/Wordmark';
import { ArrowRight, Clock } from 'lucide-react';

export default function FeaturesPage() {
  const { theme } = useTheme();

  return (
    <div
      className="min-h-screen relative overflow-hidden transition-colors duration-500"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Ambient Light */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-20%] left-[10%] w-[50vw] h-[50vh] rounded-full blur-[160px]"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)',
            opacity: theme === 'dark' ? 0.6 : 0.3,
          }}
        />
      </div>

      <Navbar />

      <main className="relative z-10">
        {/* Hero */}
        <section style={{ padding: 'clamp(112px, 12vw, 152px) clamp(16px, 5vw, 48px) clamp(48px, 6vw, 80px)', textAlign: 'center' }}>
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
            <span
              style={{
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                display: 'block',
                marginBottom: '16px',
              }}
            >
              Platform Modules
            </span>
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
              Everything Your School{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Needs</span>
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
                lineHeight: 1.7,
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              Explore the modules that power <Wordmark /> — from report cards and student management to attendance tracking and academic analytics.
            </p>
          </div>
        </section>

        {/* Active Modules Grid */}
        <section style={{ padding: '0 clamp(16px, 5vw, 48px) clamp(48px, 6vw, 80px)', maxWidth: '1280px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 'clamp(16px, 2vw, 24px)',
            }}
          >
            {modules.filter(m => m.slug !== 'settings').map((mod) => {
              const IconComponent = mod.icon;
              return (
                <div
                  key={mod.slug}
                  className="group"
                  style={{
                    padding: 'clamp(24px, 3vw, 32px)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Icon + Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-accent-glow)',
                        border: '1px solid var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IconComponent style={{ width: '22px', height: '22px', color: 'var(--color-accent)' }} />
                    </div>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        padding: '2px 10px',
                        borderRadius: '999px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: 'var(--color-success)',
                      }}
                    >
                      Active
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '1.0625rem',
                      color: 'var(--color-text-primary)',
                      marginBottom: '8px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {mod.title}
                  </h3>

                  {/* Description */}
                  <p
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8125rem',
                      lineHeight: 1.7,
                      marginBottom: '24px',
                      flex: 1,
                    }}
                  >
                    {mod.description}
                  </p>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <Link
                      href={mod.featureHref}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                        color: '#1A1816',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        textDecoration: 'none',
                        transition: 'opacity 0.2s',
                      }}
                    >
                      Learn More
                      <ArrowRight style={{ width: '14px', height: '14px' }} />
                    </Link>
                    <Link
                      href={mod.dashboardHref}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        textDecoration: 'none',
                        background: 'transparent',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      Dashboard
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Coming Soon Section */}
        <section style={{ padding: 'clamp(64px, 8vw, 96px) clamp(16px, 5vw, 48px) clamp(48px, 6vw, 80px)', maxWidth: '1280px', margin: '0 auto' }}>
          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: 'clamp(32px, 4vw, 48px)' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border-subtle)' }} />
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Clock style={{ width: '14px', height: '14px' }} />
              Coming in Phase Two
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border-subtle)' }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 'clamp(12px, 2vw, 16px)',
            }}
          >
            {comingSoonModules.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <div
                  key={mod.slug}
                  style={{
                    padding: 'clamp(20px, 2.5vw, 24px)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    opacity: 0.7,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <IconComponent style={{ width: '20px', height: '20px', color: 'var(--color-text-muted)' }} />
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--color-warning)',
                      }}
                    >
                      Coming Soon
                    </span>
                  </div>
                  <h4
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      color: 'var(--color-text-primary)',
                      marginBottom: '6px',
                    }}
                  >
                    {mod.title}
                  </h4>
                  <p
                    style={{
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.75rem',
                      lineHeight: 1.6,
                    }}
                  >
                    {mod.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
