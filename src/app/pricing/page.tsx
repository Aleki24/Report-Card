"use client";

import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'Perfect for small schools getting started with digital management.',
    features: [
      'Up to 100 students',
      'Report card generation',
      'Basic marks entry',
      '1 admin user',
      'PDF export',
      'Email support',
    ],
    cta: 'Get Started Free',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 'KES 5,000',
    period: '/term',
    description: 'For growing schools that need the full suite of management tools.',
    features: [
      'Up to 1,000 students',
      'All Phase One modules',
      'Unlimited teachers',
      'Attendance tracking',
      'Parent management',
      'Analytics dashboard',
      'Bulk report generation',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    href: '/signup',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large schools and school groups needing advanced features and support.',
    features: [
      'Unlimited students',
      'All modules including Phase Two',
      'M-Pesa integration',
      'SMS communication',
      'Parent portal',
      'Custom branding',
      'Dedicated support',
      'Data migration assistance',
      'Training sessions',
    ],
    cta: 'Contact Sales',
    href: '/contact',
    highlighted: false,
  },
];

export default function PricingPage() {
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
        <section style={{ padding: 'clamp(112px, 12vw, 152px) clamp(16px, 5vw, 48px) clamp(48px, 6vw, 80px)' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 'clamp(40px, 5vw, 64px)' }}>
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
                Plans & Pricing
              </span>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 'clamp(1.75rem, 4.5vw, 3rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text-primary)',
                  marginBottom: '20px',
                }}
              >
                Simple, Transparent{' '}
                <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Pricing</span>
              </h1>
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'clamp(0.9375rem, 1.5vw, 1.0625rem)',
                  lineHeight: 1.7,
                  maxWidth: '540px',
                  margin: '0 auto',
                }}
              >
                Choose the plan that fits your school. Start free and upgrade as you grow.
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3" style={{ gap: 'clamp(16px, 2vw, 24px)', alignItems: 'stretch' }}>
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  style={{
                    padding: 'clamp(28px, 3.5vw, 40px)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-surface)',
                    border: plan.highlighted
                      ? '2px solid var(--color-accent)'
                      : '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    boxShadow: plan.highlighted
                      ? '0 8px 40px rgba(0,0,0,0.2), 0 0 0 1px var(--color-accent-glow)'
                      : 'none',
                  }}
                >
                  {plan.highlighted && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '4px 16px',
                        borderRadius: '999px',
                        background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                        color: '#1A1816',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      Most Popular
                    </div>
                  )}

                  <div style={{ marginBottom: '24px' }}>
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '1.25rem',
                        color: 'var(--color-text-primary)',
                        marginBottom: '8px',
                      }}
                    >
                      {plan.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 'clamp(2rem, 4vw, 2.5rem)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {plan.price}
                      </span>
                      {plan.period && (
                        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.8125rem',
                        lineHeight: 1.6,
                      }}
                    >
                      {plan.description}
                    </p>
                  </div>

                  {/* Features */}
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '28px' }}>
                    {plan.features.map((f, i) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--color-success)', flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={plan.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      ...(plan.highlighted
                        ? {
                            background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
                            color: '#1A1816',
                            boxShadow: '0 4px 20px rgba(212, 168, 83, 0.3)',
                          }
                        : {
                            background: 'var(--color-surface-raised)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                          }),
                    }}
                  >
                    {plan.cta}
                    <ArrowRight style={{ width: '16px', height: '16px' }} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
