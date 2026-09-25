import type { Hue } from './tones';

/**
 * Each section of the app keeps one colour everywhere it appears: its page
 * header, and any tile or link that leads to it (dashboard quick actions,
 * KPI tiles). Keyed by route; a link to a sub-page or tab uses its section.
 */
export const PAGE_HUES: Readonly<Record<string, Hue>> = {
  '/dashboard/exams-marks': 'blue',
  '/dashboard/reports': 'violet',
  '/dashboard/attendance': 'teal',
  '/dashboard/analytics': 'sky',
  '/dashboard/people': 'orange',
  '/dashboard/classes': 'amber',
  '/dashboard/subjects': 'emerald',
  '/dashboard/fees': 'emerald',
  '/dashboard/announcements': 'rose',
  '/dashboard/assignments': 'violet',
  '/dashboard/users': 'rose',
  '/dashboard/settings': 'slate',
  '/student/results': 'violet',
  '/student/subjects': 'emerald',
  '/student/attendance': 'teal',
  '/student/fees': 'emerald',
  '/student/profile': 'blue',
};

/** The colour of the section a link points into (query strings ignored). */
export function hueForHref(href: string, fallback: Hue = 'blue'): Hue {
  const path = href.split('?')[0];
  const match = Object.keys(PAGE_HUES)
    .filter(route => path === route || path.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_HUES[match] : fallback;
}
