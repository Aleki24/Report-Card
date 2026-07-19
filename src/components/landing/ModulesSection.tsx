"use client";

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { modules } from '@/lib/modules';
import { Wordmark } from '@/components/Wordmark';

const displayModules = modules.filter(m => m.slug !== 'settings').slice(0, 3);

export default function ModulesSection() {
  return (
    <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Section Header */}
      <div className="text-center" style={{ marginBottom: 'clamp(32px, 4vw, 48px)', maxWidth: '640px', margin: '0 auto' }}>
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
            justifyContent: 'center',
            display: 'flex',
          }}
        >
          <span style={{ width: '32px', height: '1px', background: 'var(--color-accent)', display: 'inline-block' }} />
          Platform Modules
          <span style={{ width: '32px', height: '1px', background: 'var(--color-accent)', display: 'inline-block' }} />
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(1.5rem, 3.5vw, 2.75rem)',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
            marginBottom: '20px',
          }}
        >
          One Platform,{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Every Module</span>
        </h2>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.875rem, 1.4vw, 1rem)',
            lineHeight: 1.7,
            maxWidth: '520px',
            margin: '0 auto',
          }}
        >
          From student enrollment to final report cards, <Wordmark /> covers every aspect of school academic management.
        </p>
      </div>

      {/* Module Cards Grid */}
      <div
        className="grid sm:grid-cols-2 lg:grid-cols-3"
        style={{ gap: 'clamp(12px, 2vw, 16px)', maxWidth: '1024px', margin: '0 auto clamp(32px, 4vw, 48px)' }}
      >
        {displayModules.map((mod) => {
          const IconComponent = mod.icon;
          return (
            <Link
              key={mod.slug}
              href={mod.featureHref}
              className="group relative rounded-2xl border transition-all duration-500 hover:border-primary hover:shadow-lg scroll-reveal"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border-subtle)',
                padding: 'clamp(20px, 2.5vw, 24px)',
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Icon */}
              <div
                className="transition-transform duration-300 group-hover:scale-110"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent-glow)',
                  border: '1px solid var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconComponent style={{ width: '20px', height: '20px', color: 'var(--color-accent)' }} />
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {mod.title}
              </h3>

              {/* Description */}
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.75rem',
                  lineHeight: 1.6,
                  flex: 1,
                }}
              >
                {mod.description}
              </p>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  height: '2px',
                  borderRadius: '0 0 16px 16px',
                  background: 'linear-gradient(90deg, var(--color-accent), transparent)',
                }}
              />
            </Link>
          );
        })}
      </div>

      {/* View All CTA */}
      <div style={{ textAlign: 'center' }}>
        <Link
          href="/features"
          className="group inline-flex items-center rounded-xl transition-all duration-300 hover:border-primary"
          style={{
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: '0.875rem',
            padding: '10px 22px',
            gap: '10px',
            background: 'transparent',
            textDecoration: 'none',
          }}
        >
          View All Features
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" style={{ color: 'var(--color-accent)' }} />
        </Link>
      </div>
    </section>
  );
}
