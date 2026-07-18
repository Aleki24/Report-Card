"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="relative z-10" style={{ padding: 'clamp(32px, 4vw, 48px) clamp(16px, 5vw, 48px)', borderTop: '1px solid var(--color-border-subtle)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between" style={{ gap: '32px', marginBottom: '24px' }}>
          <div className="flex items-center" style={{ gap: '12px' }}>
            <Image src="/images/logo.png" alt="Skulbase Logo" width={36} height={36} className="rounded-lg object-cover" />
            <div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '1.125rem', letterSpacing: '-0.01em', display: 'block' }}>Skulbase</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Modern School Management</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: '24px' }}>
            {[{ label: 'Features', href: '/features' }, { label: 'Pricing', href: '/pricing' }, { label: 'Contact', href: '/contact' }, { label: 'Dashboard', href: '/dashboard' }].map((link) => (
              <Link key={link.href} href={link.href} style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }} className="hover:text-foreground">{link.label}</Link>
            ))}
          </div>
        </div>
        <div style={{ height: '1px', background: 'var(--color-border-subtle)', marginBottom: '24px' }} />
        <div className="flex flex-col sm:flex-row items-center justify-between" style={{ gap: '16px' }}>
          <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.75rem' }}>© {new Date().getFullYear()} Skulbase School Management System. All rights reserved.</span>
          <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.6875rem' }}>Built for Kenyan Schools 🇰🇪</span>
        </div>
      </div>
    </footer>
  );
}
