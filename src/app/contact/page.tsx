"use client";

import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Wordmark } from '@/components/Wordmark';
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const { theme } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, schoolName, message }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed to send your message.');
      else {
        setSent(true);
        setName(''); setEmail(''); setSchoolName(''); setMessage('');
      }
    } catch {
      setError('Network error. Please try again or email us directly.');
    } finally {
      setSubmitting(false);
    }
  };

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
                Have questions about <Wordmark />? Want to bring modern school management to your institution? We&apos;d love to hear from you.
              </p>
            </div>

            <div className="grid lg:grid-cols-5" style={{ gap: 'clamp(24px, 3vw, 40px)' }}>
              {/* Contact Info */}
              <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { icon: Mail, label: 'Email', value: 'alexotieno293@gmail.com', href: 'mailto:alexotieno293@gmail.com' },
                  { icon: Phone, label: 'Phone', value: '0740 129 444', href: 'tel:+254740129444' },
                  { icon: MapPin, label: 'Location', value: 'Kenya', href: undefined },
                ].map((item, idx) => {
                  const content = (
                    <>
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
                    </>
                  );
                  const sharedStyle: React.CSSProperties = {
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    textDecoration: 'none',
                  };
                  return item.href ? (
                    <a key={idx} href={item.href} style={sharedStyle} className="transition-colors hover:border-primary">
                      {content}
                    </a>
                  ) : (
                    <div key={idx} style={sharedStyle}>{content}</div>
                  );
                })}
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
                {sent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', padding: '32px 0' }}>
                    <CheckCircle2 style={{ width: '40px', height: '40px', color: 'var(--color-success)' }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Message sent!</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>We&apos;ll get back to you soon.</p>
                    <button type="button" className="btn-secondary" onClick={() => setSent(false)}>Send another message</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {error && <div className="p-3 rounded-md text-sm bg-red-500/10 text-red-400 border border-red-500/30">{error}</div>}
                    <div className="grid sm:grid-cols-2" style={{ gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                          Full Name
                        </label>
                        <input className="input-field" placeholder="John Kamau" value={name} onChange={e => setName(e.target.value)} required />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                          Email Address
                        </label>
                        <input className="input-field" type="email" placeholder="john@school.ac.ke" value={email} onChange={e => setEmail(e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        School Name
                      </label>
                      <input className="input-field" placeholder="Nairobi Academy" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
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
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary disabled:opacity-50"
                      style={{ alignSelf: 'flex-start', gap: '8px' }}
                      disabled={submitting}
                    >
                      {submitting ? <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" /> : <Send style={{ width: '16px', height: '16px' }} />}
                      {submitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
