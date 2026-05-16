"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sun, Moon, Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { FeaturesDropdown } from './navbar/FeaturesDropdown';
import { MobileNavMenu } from './navbar/MobileNavMenu';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) { setMobileOpen(false); setMobileFeaturesOpen(false); }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setFeaturesOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinkStyle = {
    color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)',
    fontSize: '0.8125rem', fontWeight: 500 as const, padding: '8px 14px',
    letterSpacing: '0.01em', textDecoration: 'none', borderRadius: '8px',
    transition: 'all 0.2s ease', display: 'inline-flex', alignItems: 'center', gap: '4px',
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 w-full z-50 backdrop-blur-xl"
      style={{
        padding: 'clamp(16px, 3vw, 24px) clamp(16px, 5vw, 48px)',
        background: 'var(--color-bg)',
        backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div className="flex items-center justify-between" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/images/logo.jpg" alt="Matokeo Logo" width={44} height={44}
            className="rounded-lg object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)' }}
          />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', letterSpacing: '-0.01em' }}>
            Matokeo
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center" style={{ gap: '4px' }}>
          <Link href="/" className="rounded-lg transition-all duration-200 hover:bg-muted" style={navLinkStyle}>Home</Link>

          {/* Features Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setFeaturesOpen(!featuresOpen)}
              className="rounded-lg transition-all duration-200 hover:bg-muted cursor-pointer"
              style={{ ...navLinkStyle, background: featuresOpen ? 'var(--color-surface-raised)' : 'transparent', border: 'none' }}
            >
              Features
              <ChevronDown style={{ width: '14px', height: '14px', transition: 'transform 0.2s', transform: featuresOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
            </button>
            <FeaturesDropdown isOpen={featuresOpen} onClose={() => setFeaturesOpen(false)} />
          </div>

          <Link href="/contact" className="rounded-lg transition-all duration-200 hover:bg-muted" style={navLinkStyle}>Contact</Link>
          <Link href="/pricing" className="rounded-lg transition-all duration-200 hover:bg-muted" style={navLinkStyle}>Pricing</Link>

          <div style={{ width: '1px', height: '20px', background: 'var(--color-border-subtle)', margin: '0 4px' }} />

          <button onClick={toggleTheme} className="rounded-lg transition-all duration-200 hover:bg-muted"
            style={{ color: 'var(--color-text-muted)', padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Toggle Theme">
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          <Link href="/login" className="inline-flex items-center rounded-lg transition-all duration-200 hover:bg-muted"
            style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 500, padding: '8px 16px', letterSpacing: '0.01em' }}>
            Sign In
          </Link>

          <Link href="/dashboard" className="inline-flex items-center rounded-lg transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(145deg, var(--color-accent), var(--color-accent-light))',
              color: '#1A1816', fontFamily: 'var(--font-body)', fontSize: '0.8125rem', fontWeight: 600,
              padding: '8px 16px', gap: '8px', letterSpacing: '0.01em', boxShadow: '0 2px 12px rgba(212, 168, 83, 0.2)',
            }}>
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile: Theme toggle + Hamburger */}
        <div className="flex sm:hidden items-center" style={{ gap: '8px' }}>
          <button onClick={toggleTheme} className="rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-text-muted)', padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Toggle Theme">
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <button onClick={() => { setMobileOpen(!mobileOpen); setMobileFeaturesOpen(false); }}
            className="rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-text-primary)', padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Toggle Menu">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <MobileNavMenu
        isOpen={mobileOpen} onClose={() => setMobileOpen(false)}
        mobileFeaturesOpen={mobileFeaturesOpen} setMobileFeaturesOpen={setMobileFeaturesOpen}
      />
    </nav>
  );
}
