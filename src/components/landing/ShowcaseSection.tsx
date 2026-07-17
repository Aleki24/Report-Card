"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

const FEATURES = [
  {
    kicker: 'Mark Entry',
    title: 'Marks entry that keeps up with your teachers',
    description:
      'Whether it\'s one subject or the whole exam, marks go in fast — and only the students who actually take a subject show up on its list.',
    image: '/images/dashboard_marks_icon.png',
    imageAlt: 'Glass 3D grade report with a pen',
    color: 'var(--color-accent)',
    points: [
      'Quick grid entry per subject and class',
      'Bulk upload marks from CSV in seconds',
      'Snap a photo of a handwritten marksheet — we read it',
      'Electives scoped to their actual takers',
    ],
  },
  {
    kicker: 'Report Cards',
    title: 'Report cards parents actually keep',
    description:
      'Auto-graded against your own CBC or 8-4-4 grading scales, laid out on polished templates, and generated for the whole class in one click.',
    image: '/images/dashboard_report_icon.png',
    imageAlt: 'Glowing 3D analytics report on a clipboard',
    color: 'var(--color-success)',
    points: [
      'Multiple professional PDF templates',
      'School logo, grading key and teacher comments included',
      'Class-wide generation in a single click',
      'Delivered to parents by SMS or download',
    ],
  },
  {
    kicker: 'Analytics',
    title: 'Spot the trend before the term ends',
    description:
      'Rankings, averages and subject breakdowns update as marks come in — so you see who\'s soaring and who needs help while there\'s still time to act.',
    image: '/images/dashboard_comparison_icon.png',
    imageAlt: 'Frosted glass 3D bar chart comparison',
    color: 'var(--color-purple-500)',
    points: [
      'Class and subject performance at a glance',
      'Student rankings and term-over-term comparison',
      'CBC pathways and KCSE points supported',
      'Deep-dive dashboards for every role',
    ],
  },
  {
    kicker: 'Onboarding',
    title: 'Onboard the whole school in an afternoon',
    description:
      'Import your student roll from a spreadsheet, and every teacher, student and guardian gets a one-time invite code — by SMS or email — to activate their own account.',
    image: '/images/dashboard_bulk_icon.png',
    imageAlt: 'Colorful stack of 3D books tied with a ribbon',
    color: 'var(--color-warning)',
    points: [
      'Bulk CSV import for students',
      'Usernames generated automatically',
      'Invite codes delivered by SMS and email',
      'Role-based access from day one',
    ],
  },
];

export default function ShowcaseSection() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <section id="showcase" style={{ padding: 'clamp(48px, 6vw, 96px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Section Header */}
      <div className="text-center" style={{ marginBottom: 'clamp(48px, 6vw, 80px)', maxWidth: '680px', marginLeft: 'auto', marginRight: 'auto' }}>
        <span
          className="inline-flex items-center justify-center"
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
          <span style={{ width: '32px', height: '1px', background: 'var(--color-accent)' }} />
          Why Schools Switch
          <span style={{ width: '32px', height: '1px', background: 'var(--color-accent)' }} />
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(1.625rem, 3.8vw, 3rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
            marginBottom: '18px',
          }}
        >
          Built around the work{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>you actually do</span>
        </h2>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(0.875rem, 1.4vw, 1.0625rem)',
            lineHeight: 1.7,
            maxWidth: '540px',
            margin: '0 auto',
          }}
        >
          Not another generic dashboard — every screen maps to something a Kenyan school
          does every term.
        </p>
      </div>

      {/* Feature rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(56px, 7vw, 104px)' }}>
        {FEATURES.map((feature, idx) => {
          const reversed = idx % 2 === 1;
          return (
            <div
              key={feature.kicker}
              className={`flex flex-col ${reversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center`}
              style={{ gap: 'clamp(32px, 5vw, 72px)' }}
            >
              {/* Image panel */}
              <div className="w-full lg:w-1/2 relative">
                {/* Glow */}
                <div
                  className="absolute rounded-full blur-[80px] pointer-events-none"
                  style={{
                    inset: '15%',
                    background: `radial-gradient(circle, ${feature.color} 0%, transparent 70%)`,
                    opacity: isDark ? 0.25 : 0.15,
                  }}
                />
                <div
                  className="relative rounded-3xl overflow-hidden transition-transform duration-500 hover:scale-[1.015]"
                  style={{
                    border: '1px solid var(--color-border)',
                    boxShadow: isDark
                      ? '0 32px 80px rgba(0,0,0,0.5)'
                      : '0 32px 80px rgba(0,0,0,0.12)',
                    aspectRatio: '4 / 3',
                  }}
                >
                  <Image
                    src={feature.image}
                    alt={feature.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    style={{ objectFit: 'cover' }}
                  />
                  {/* Kicker badge on image */}
                  <span
                    className="absolute rounded-full backdrop-blur-md"
                    style={{
                      top: '16px',
                      left: '16px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      fontFamily: 'var(--font-body)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: '#FFFFFF',
                      background: 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '6px 14px',
                    }}
                  >
                    {feature.kicker}
                  </span>
                </div>
              </div>

              {/* Copy */}
              <div className="w-full lg:w-1/2 text-center lg:text-left">
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 'clamp(1.375rem, 2.6vw, 2rem)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text-primary)',
                    marginBottom: '16px',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'clamp(0.875rem, 1.4vw, 1rem)',
                    lineHeight: 1.7,
                    marginBottom: '24px',
                    letterSpacing: '0.01em',
                  }}
                >
                  {feature.description}
                </p>
                <ul
                  className="inline-flex flex-col items-start text-left"
                  style={{ gap: '12px', marginBottom: '28px' }}
                >
                  {feature.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start"
                      style={{
                        gap: '10px',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <CheckCircle2
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: feature.color, marginTop: '2px' }}
                      />
                      {point}
                    </li>
                  ))}
                </ul>
                <div>
                  <Link
                    href="/features"
                    className="group inline-flex items-center transition-opacity hover:opacity-80"
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      gap: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    See it in detail
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
