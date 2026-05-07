"use client";

import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Mail, Phone, MapPin, Send } from 'lucide-react';

export default function ContactPage() {
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
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>
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
                Get in Touch
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
                Contact <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Us</span>
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
                Have questions about Matokeo? Want to bring modern school management to your institution? We&apos;d love to hear from you.
              </p>
            </div>

            <div className="grid lg:grid-cols-5" style={{ gap: 'clamp(24px, 3vw, 40px)' }}>
              {/* Contact Info */}
              <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { icon: Mail, label: 'Email', value: 'hello@matokeo.app' },
                  { icon: Phone, label: 'Phone', value: '+254 700 000 000' },
                  { icon: MapPin, label: 'Location', value: 'Nairobi, Kenya' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      padding: '20px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-accent-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <item.icon style={{ width: '18px', height: '18px', color: 'var(--color-accent)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.9375rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Contact Form */}
              <div
                className="lg:col-span-3"
                style={{
                  padding: 'clamp(24px, 3vw, 32px)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="grid sm:grid-cols-2" style={{ gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Full Name
                      </label>
                      <input className="input-field" placeholder="John Kamau" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Email Address
                      </label>
                      <input className="input-field" type="email" placeholder="john@school.ac.ke" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      School Name
                    </label>
                    <input className="input-field" placeholder="Nairobi Academy" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                      Message
                    </label>
                    <textarea
                      className="input-field"
                      rows={5}
                      placeholder="Tell us about your school and what you need..."
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ alignSelf: 'flex-start', gap: '8px' }}
                  >
                    <Send style={{ width: '16px', height: '16px' }} />
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
