import type { Hue } from './theme';

/**
 * Each section keeps one colour everywhere it appears (the web's
 * components/ui/pageHues.ts), keyed by the app's routes.
 */
const PAGE_HUES: Readonly<Record<string, Hue>> = {
    '/staff/exams': 'blue',
    '/staff/reports': 'violet',
    '/staff/attendance': 'teal',
    '/staff/analytics': 'sky',
    '/staff/people': 'orange',
    '/staff/classes': 'amber',
    '/staff/subjects': 'emerald',
    '/staff/fees': 'emerald',
    '/staff/announcements': 'rose',
    '/staff/assignments': 'violet',
    '/staff/users': 'rose',
    '/staff/settings': 'slate',
    '/student/results': 'violet',
    '/student/subjects': 'emerald',
    '/student/attendance': 'teal',
    '/student/fees': 'emerald',
    '/student/timetable': 'sky',
    '/student/profile': 'blue',
};

/** The colour of the section a link points into (query strings ignored). */
export function hueForHref(href: string, fallback: Hue = 'blue'): Hue {
    const path = href.split('?')[0];
    const match = Object.keys(PAGE_HUES)
        .filter((route) => path === route || path.startsWith(`${route}/`))
        .sort((a, b) => b.length - a.length)[0];
    return match ? PAGE_HUES[match] : fallback;
}
