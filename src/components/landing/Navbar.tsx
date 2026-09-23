"use client";

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { useTheme } from '@/components/ThemeProvider';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/utils';
import { CtaLink } from './ui/CtaLink';
import { FeaturesDropdown } from './navbar/FeaturesDropdown';
import { MobileNavMenu } from './navbar/MobileNavMenu';
import { DESKTOP_NAV_QUERY, NAV_ITEMS } from './navbar/navConfig';

const NAV_LINK =
  'inline-flex min-h-10 items-center gap-1 rounded-lg px-3.5 text-[0.8125rem] font-medium tracking-wide text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

const ICON_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <button type="button" onClick={toggleTheme} className={ICON_BUTTON} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
      <Icon className="size-4.5" aria-hidden />
    </button>
  );
}

export default function Navbar() {
  const { isSignedIn } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  const mobileMenuId = useId();

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setMobileFeaturesOpen(false);
  }, []);

  // The mobile menu has no place on desktop — drop it when the viewport widens.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_NAV_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeMobile();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [closeMobile]);

  // Features dropdown closes on outside click or Escape.
  useEffect(() => {
    if (!featuresOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setFeaturesOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFeaturesOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [featuresOpen]);

  // Signed-out visitors get guided into joining; signed-in users keep their dashboard shortcut.
  const cta = isSignedIn ? { href: '/dashboard', label: 'Dashboard' } : { href: '/signup', label: 'Get Started' };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 top-0 z-50 w-full border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur-xl sm:px-6 md:py-5 lg:px-12"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="group flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Image
            src="/images/logo.png"
            alt=""
            width={44}
            height={44}
            className="rounded-lg object-cover shadow-lg shadow-black/15 transition-transform duration-300 group-hover:scale-105"
          />
          <Wordmark className="font-heading text-xl font-semibold tracking-tight md:text-2xl" />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) =>
            item.kind === 'link' ? (
              <Link key={item.label} href={item.href} className={NAV_LINK}>
                {item.label}
              </Link>
            ) : (
              <div key={item.label} ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setFeaturesOpen((open) => !open)}
                  aria-expanded={featuresOpen}
                  aria-controls={dropdownId}
                  className={cn(NAV_LINK, 'cursor-pointer', featuresOpen && 'bg-muted text-foreground')}
                >
                  {item.label}
                  <ChevronDown className={cn('size-3.5 transition-transform duration-200', featuresOpen && 'rotate-180')} aria-hidden />
                </button>
                <FeaturesDropdown id={dropdownId} isOpen={featuresOpen} onClose={() => setFeaturesOpen(false)} />
              </div>
            ),
          )}

          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <ThemeToggle />
          <Link href="/login" className={cn(NAV_LINK, 'px-4')}>
            Sign In
          </Link>
          <CtaLink href={cta.href} size="md" className="min-h-10 gap-2 px-4 py-2 text-[0.8125rem] shadow-none hover:translate-y-0">
            {cta.label}
          </CtaLink>
        </div>

        {/* Mobile & tablet */}
        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => (mobileOpen ? closeMobile() : setMobileOpen(true))}
            aria-expanded={mobileOpen}
            aria-controls={mobileMenuId}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className={cn(ICON_BUTTON, 'text-foreground')}
          >
            {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <MobileNavMenu
        id={mobileMenuId}
        isOpen={mobileOpen}
        onClose={closeMobile}
        featuresOpen={mobileFeaturesOpen}
        onToggleFeatures={() => setMobileFeaturesOpen((open) => !open)}
        cta={cta}
      />
    </nav>
  );
}
