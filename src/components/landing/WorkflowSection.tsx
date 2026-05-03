"use client";

import { Settings, ListChecks, Printer } from 'lucide-react';

export default function WorkflowSection() {
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
            How It Works
          </span>
          <div className="flex-1" style={{ height: '1px', background: 'var(--color-border-subtle)' }} />
        </div>
      </div>

      {/* ===== WORKFLOW SECTION ===== */}
      <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
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
            From Blank Sheets to{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>
              Finalized Reports
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
            A streamlined, three-step workflow that takes you from initial setup to polished PDF report cards.
          </p>
        </div>

        {/* Steps — Editorial Layout */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'clamp(16px, 2vw, 24px)' }}>
          {[
            {
              step: '01',
              icon: Settings,
              title: 'Configure Structure',
              desc: 'Admins define the academic year, terms, classes, subjects, and grading criteria reflecting the school\'s curriculum.',
              color: 'var(--color-accent)',
            },
            {
              step: '02',
              icon: ListChecks,
              title: 'Enter Marks',
              desc: 'Teachers log in to rapidly input exam scores for their subjects. Real-time auto-save ensures no data is ever lost.',
              color: 'var(--color-success)',
            },
            {
              step: '03',
              icon: Printer,
              title: 'Generate Reports',
              desc: 'One click compiles scores, calculates rankings, and produces beautifully formatted PDF report cards at scale.',
              color: 'var(--color-warning)',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl border transition-all duration-500 hover:border-[var(--color-accent)] hover:shadow-lg"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border-subtle)',
                padding: 'clamp(24px, 3vw, 32px)',
              }}
            >
              {/* Step Number */}
              <div className="flex items-center justify-between" style={{ marginBottom: '32px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(3rem, 5vw, 3.75rem)',
                    fontWeight: 900,
                    lineHeight: 1,
                    color: 'var(--color-text-primary)',
                    opacity: 0.06,
                  }}
                >
                  {item.step}
                </span>
                <div
                  className="flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: `${item.color}12`,
                    border: `1px solid ${item.color}20`,
                  }}
                >
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
              </div>

              {/* Content */}
              <h3
                style={{
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1rem, 1.6vw, 1.125rem)',
                  fontWeight: 700,
                  marginBottom: '12px',
                  letterSpacing: '-0.01em',
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  letterSpacing: '0.01em',
                  wordSpacing: '0.02em',
                }}
              >
                {item.desc}
              </p>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  height: '2px',
                  borderRadius: '0 0 16px 16px',
                  background: `linear-gradient(90deg, ${item.color}, transparent)`,
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
