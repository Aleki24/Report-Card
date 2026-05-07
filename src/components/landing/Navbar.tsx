"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sun, Moon, Menu, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { modules } from '@/lib/modules';

const featureModules = modules.filter(m => m.slug !== 'settings');

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) {
        setMobileOpen(false);
        setMobileFeaturesOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close features dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFeaturesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinkStyle = {
    color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8125rem',
    fontWeight: 500 as const,
    padding: '8px 14px',
    letterSpacing: '0.01em',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
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

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center" style={{ gap: '4px' }}>
          {/* Home */}
          <Link href="/" className="rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)]" style={navLinkStyle}>
            Home
          </Link>

          {/* Features Dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setFeaturesOpen(!featuresOpen)}
              className="rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)] cursor-pointer"
              style={{
                ...navLinkStyle,
                background: featuresOpen ? 'var(--color-surface-raised)' : 'transparent',
                border: 'none',
              }}
            >
              Features
              <ChevronDown
                style={{
                  width: '14px',
                  height: '14px',
                  transition: 'transform 0.2s',
                  transform: featuresOpen ? 'rotate(180deg)' : 'rotate(0)',
                }}
              />
            </button>

            {/* Dropdown Panel */}
            {featuresOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '380px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  padding: '8px',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
                  zIndex: 100,
                }}
              >
                <div style={{ padding: '8px 12px 12px', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Platform Modules
                  </span>
                </div>
                {featureModules.map((mod) => {
                  const IconComponent = mod.icon;
                  return (
                    <Link
                      key={mod.slug}
                      href={mod.featureHref}
                      onClick={() => setFeaturesOpen(false)}
                      className="rounded-lg transition-all duration-150 hover:bg-[var(--color-surface-raised)]"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        textDecoration: 'none',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'var(--color-accent-glow)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent style={{ width: '16px', height: '16px', color: 'var(--color-accent)' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3 }}>
                          {mod.title}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', lineHeight: 1.4, marginTop: '1px' }}>
                          {mod.shortTitle === mod.title ? mod.description.slice(0, 60) + '…' : mod.description.slice(0, 60) + '…'}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '4px', paddingTop: '4px' }}>
                  <Link
                    href="/features"
                    onClick={() => setFeaturesOpen(false)}
                    className="rounded-lg transition-all duration-150 hover:bg-[var(--color-surface-raised)]"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      textDecoration: 'none',
                      color: 'var(--color-accent)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    View All Features
                    <ArrowRight style={{ width: '14px', height: '14px' }} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Contact */}
          <Link href="/contact" className="rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)]" style={navLinkStyle}>
            Contact
          </Link>

          {/* Pricing */}
          <Link href="/pricing" className="rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)]" style={navLinkStyle}>
            Pricing
          </Link>

          {/* Separator */}
          <div style={{ width: '1px', height: '20px', background: 'var(--color-border-subtle)', margin: '0 4px' }} />

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-raised)]"
            style={{ color: 'var(--color-text-muted)', padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          {/* Sign In */}
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

          {/* Dashboard CTA */}
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
            style={{ color: 'var(--color-text-muted)', padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
          <button
            onClick={() => { setMobileOpen(!mobileOpen); setMobileFeaturesOpen(false); }}
            className="rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-text-primary)', padding: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
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
            padding: '12px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {/* Home */}
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg transition-all duration-200"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              padding: '12px 16px',
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Home
          </Link>

          {/* Features (Expandable) */}
          <button
            onClick={() => setMobileFeaturesOpen(!mobileFeaturesOpen)}
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              background: mobileFeaturesOpen ? 'var(--color-surface-raised)' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Features
            <ChevronDown
              style={{
                width: '16px',
                height: '16px',
                transition: 'transform 0.2s',
                transform: mobileFeaturesOpen ? 'rotate(180deg)' : 'rotate(0)',
              }}
            />
          </button>

          {mobileFeaturesOpen && (
            <div style={{ paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {featureModules.map((mod) => {
                const IconComponent = mod.icon;
                return (
                  <Link
                    key={mod.slug}
                    href={mod.featureHref}
                    onClick={() => { setMobileOpen(false); setMobileFeaturesOpen(false); }}
                    className="rounded-lg transition-all duration-150 hover:bg-[var(--color-surface-raised)]"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      textDecoration: 'none',
                      color: 'var(--color-text-secondary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                    }}
                  >
                    <IconComponent style={{ width: '16px', height: '16px', color: 'var(--color-accent)', flexShrink: 0 }} />
                    {mod.title}
                  </Link>
                );
              })}
              <Link
                href="/features"
                onClick={() => { setMobileOpen(false); setMobileFeaturesOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  textDecoration: 'none',
                  color: 'var(--color-accent)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                View All Features
                <ChevronRight style={{ width: '14px', height: '14px' }} />
              </Link>
            </div>
          )}

          {/* Contact */}
          <Link
            href="/contact"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg transition-all duration-200"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              padding: '12px 16px',
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Contact
          </Link>

          {/* Pricing */}
          <Link
            href="/pricing"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg transition-all duration-200"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              padding: '12px 16px',
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Pricing
          </Link>

          <div style={{ height: '1px', background: 'var(--color-border-subtle)', margin: '4px 0' }} />

          {/* Sign In */}
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
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Sign In
          </Link>

          {/* Dashboard */}
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
              display: 'block',
              textDecoration: 'none',
            }}
          >
            Dashboard
          </Link>
        </div>
      )}
    </nav>
  );
}
