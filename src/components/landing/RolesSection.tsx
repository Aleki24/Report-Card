"use client";

import { BookOpen, CheckCircle2, ShieldCheck, Users, Heart } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function RolesSection() {
  const { theme } = useTheme();

  const roles = [
    {
      label: 'Full Control',
      title: 'Administrator',
      description: 'Complete school management — academics, users, settings, and system-wide analytics from a single command center.',
      icon: ShieldCheck,
      iconBg: 'var(--color-accent-glow)',
      iconBorder: 'rgba(212, 168, 83, 0.15)',
      iconColor: 'var(--color-accent)',
      hoverBorder: 'var(--color-accent)',
      features: [
        'School structure & grading config',
        'Teacher and student management',
        'Report card generation & export',
        'Global analytics & performance insights',
      ],
    },
    {
      label: 'Streamlined Input',
      title: 'Teachers',
      description: 'Dedicated interface for marks entry, attendance tracking, report generation, and class performance monitoring.',
      icon: BookOpen,
      secondIcon: Users,
      iconBg: 'rgba(92, 184, 122, 0.1)',
      iconBorder: 'rgba(92, 184, 122, 0.15)',
      iconColor: 'var(--color-success)',
      hoverBorder: 'var(--color-success)',
      features: [
        'Rapid exam marks input',
        'Daily attendance marking',
        'Class performance overview',
        'Report card comments & generation',
      ],
    },
    {
      label: 'Connected Access',
      title: 'Students & Parents',
      description: 'Personalized dashboards for students to track progress and for parents to stay connected with their child\'s academic journey.',
      icon: Heart,
      iconBg: 'rgba(159, 122, 234, 0.1)',
      iconBorder: 'rgba(159, 122, 234, 0.15)',
      iconColor: 'var(--color-purple-500)',
      hoverBorder: 'var(--color-purple-500)',
      features: [
        'Personal academic performance view',
        'Report card download access',
        'Subject-wise analytics & trends',
        'Parent portal access (coming soon)',
      ],
    },
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
        {/* Section Header */}
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
              fontSize: 'clamp(1.5rem, 3.5vw, 2.75rem)',
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
              fontSize: 'clamp(0.875rem, 1.4vw, 1rem)',
              lineHeight: 1.7,
              maxWidth: '480px',
              letterSpacing: '0.01em',
              wordSpacing: '0.02em',
            }}
          >
            Skulbase intelligently scopes access and tools to match each user&apos;s responsibilities.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'clamp(16px, 2vw, 24px)', maxWidth: '1100px', margin: '0 auto' }}>
          {roles.map((role, idx) => (
            <div
              key={idx}
              className={`group relative rounded-2xl border transition-all duration-500 hover:border-[${role.hoverBorder}] scroll-reveal`}
              style={{
                padding: 'clamp(24px, 4vw, 36px)',
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border-subtle)',
                boxShadow: theme === 'dark' ? '0 8px 40px rgba(0,0,0,0.3)' : '0 8px 40px rgba(0,0,0,0.06)',
              }}
            >
              {/* Icons */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{
                    width: '52px',
                    height: '52px',
                    background: role.iconBg,
                    border: `1px solid ${role.iconBorder}`,
                  }}
                >
                  <role.icon className="w-6 h-6" style={{ color: role.iconColor }} />
                </div>
                {role.secondIcon && (
                  <div
                    className="flex items-center justify-center rounded-xl"
                    style={{
                      width: '52px',
                      height: '52px',
                      background: 'rgba(159, 122, 234, 0.1)',
                      border: '1px solid rgba(159, 122, 234, 0.15)',
                    }}
                  >
                    <role.secondIcon className="w-6 h-6" style={{ color: 'var(--color-purple-500)' }} />
                  </div>
                )}
              </div>

              {/* Label */}
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
                {role.label}
              </span>

              {/* Title */}
              <h3
                style={{
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.125rem, 1.8vw, 1.25rem)',
                  fontWeight: 700,
                  marginTop: '8px',
                  marginBottom: '14px',
                  letterSpacing: '-0.01em',
                }}
              >
                {role.title}
              </h3>

              {/* Description */}
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  marginBottom: '24px',
                  letterSpacing: '0.01em',
                }}
              >
                {role.description}
              </p>

              {/* Features */}
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {role.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8125rem',
                      gap: '10px',
                      letterSpacing: '0.01em',
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: role.iconColor }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
