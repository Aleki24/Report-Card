import { modules } from '@/lib/modules';

/** A top-level nav entry: a plain link, or the Features menu of modules. */
export type NavItem = { kind: 'link'; label: string; href: string } | { kind: 'features'; label: string };

export const NAV_ITEMS: NavItem[] = [
  { kind: 'link', label: 'Home', href: '/' },
  { kind: 'features', label: 'Features' },
  { kind: 'link', label: 'Contact', href: '/contact' },
  { kind: 'link', label: 'Pricing', href: '/pricing' },
];

/** Modules listed under Features — Settings is admin plumbing, not a selling point. */
export const FEATURE_MODULES = modules.filter((m) => m.slug !== 'settings');

/** Width at which the full nav replaces the hamburger; keep in sync with the `lg:` classes. */
export const DESKTOP_NAV_QUERY = '(min-width: 1025px)';
