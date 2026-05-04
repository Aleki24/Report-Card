"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BarChart3, Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav 
      className="fixed top-0 left-0 right-0 w-full z-50 backdrop-blur-xl" 
      style={{ 
        padding: 'clamp(16px, 3vw, 24px) clamp(16px, 5vw, 48px)',
        background: 'var(--color-bg)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        borderBottom: '1px solid var(--color-border-subtle)'
      }}
    >
      <div className="flex items-center justify-between" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.jpg"
            alt="Matokeo Logo"
            width={44}
            height={44}
            className="rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
            style={{
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)',
              letterSpacing: '-0.01em',
            }}
          >
            Matokeo
          </span>
        </Link>

        {/* Desktop Nav Actions */}
        <div className="hidden sm:flex items-center" style={{ gap: 'clamp(8px, 1.5vw, 12px)' }}>
          <button
            onClick={toggleTheme}
            className="rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-muted)', padding: '10px' }}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          <Link
            href="/login"
            className="inline-flex items-center rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)]"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              padding: '8px 16px',
              letterSpacing: '0.01em',
            }}
          >
            Sign In
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
              color: '#1A1816',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              padding: '8px 16px',
              gap: '8px',
              letterSpacing: '0.01em',
              boxShadow: '0 2px 12px rgba(212, 168, 83, 0.2)',
            }}
          >
            Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile: Theme toggle + Hamburger */}
        <div className="flex sm:hidden items-center" style={{ gap: '8px' }}>
          <button
            onClick={toggleTheme}
            className="rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-text-muted)', padding: '10px' }}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-text-primary)', padding: '10px' }}
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div
          className="sm:hidden"
          style={{
            marginTop: '16px',
            padding: '16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg transition-all duration-200"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              padding: '12px 16px',
              letterSpacing: '0.01em',
              display: 'block',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg transition-all duration-200 text-center"
            style={{
              background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
              color: '#1A1816',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              padding: '12px 16px',
              letterSpacing: '0.01em',
              display: 'block',
            }}
          >
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}
