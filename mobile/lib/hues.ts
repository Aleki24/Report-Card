import type { Hue } from './theme';

export interface PageIdentity {
    hue: Hue;
    /** The menu section, shown small above the title (the web's PageHeader eyebrow). */
    eyebrow?: string;
}

/**
 * Each section keeps one colour everywhere it appears: its header, and any
 * tile or link that leads to it. The same hues and eyebrows as the web's
 * page headers (each page.tsx under src/app), keyed by the app's routes.
 */
const PAGES: Readonly<Record<string, PageIdentity>> = {
    '/staff/exams': { hue: 'blue', eyebrow: 'Academics' },
    '/staff/reports': { hue: 'violet', eyebrow: 'Academics' },
    '/staff/attendance': { hue: 'teal', eyebrow: 'Academics' },
    '/staff/calendar': { hue: 'blue', eyebrow: 'Academics' },
    '/staff/timetable': { hue: 'teal', eyebrow: 'Academics' },
    '/staff/exam-papers': { hue: 'violet', eyebrow: 'Academics' },
    '/staff/lesson-records': { hue: 'violet', eyebrow: 'Academics' },
    '/staff/cbc': { hue: 'emerald', eyebrow: 'Academics' },
    '/staff/analytics': { hue: 'sky', eyebrow: 'Insights' },
    '/staff/people': { hue: 'orange', eyebrow: 'School' },
    '/staff/parent-accounts': { hue: 'rose', eyebrow: 'School' },
    '/staff/classes': { hue: 'amber', eyebrow: 'School' },
    '/staff/subjects': { hue: 'emerald', eyebrow: 'School' },
    '/staff/fees': { hue: 'emerald', eyebrow: 'Finance' },
    '/staff/billing': { hue: 'emerald', eyebrow: 'Finance' },
    '/staff/expenses': { hue: 'orange', eyebrow: 'Finance' },
    '/staff/boarding': { hue: 'amber', eyebrow: 'Welfare' },
    '/staff/health': { hue: 'violet', eyebrow: 'Welfare' },
    '/staff/discipline': { hue: 'rose', eyebrow: 'Welfare' },
    '/staff/transport': { hue: 'amber', eyebrow: 'Operations' },
    '/staff/library': { hue: 'blue', eyebrow: 'Operations' },
    '/staff/inventory': { hue: 'orange', eyebrow: 'Operations' },
    '/staff/leave': { hue: 'sky', eyebrow: 'Operations' },
    '/staff/announcements': { hue: 'rose', eyebrow: 'Communication' },
    '/staff/assignments': { hue: 'violet', eyebrow: 'Communication' },
    '/staff/users': { hue: 'rose', eyebrow: 'Administration' },
    '/staff/settings': { hue: 'slate', eyebrow: 'Administration' },
    '/staff/pending-schools': { hue: 'amber', eyebrow: 'Platform' },
    '/staff/profile': { hue: 'blue', eyebrow: 'Account' },
    '/student/results': { hue: 'violet', eyebrow: 'Academics' },
    '/student/subjects': { hue: 'emerald', eyebrow: 'Academics' },
    '/student/timetable': { hue: 'teal', eyebrow: 'Academics' },
    '/student/attendance': { hue: 'teal', eyebrow: 'My school' },
    '/student/fees': { hue: 'emerald', eyebrow: 'Finance' },
    '/student/profile': { hue: 'blue', eyebrow: 'Account' },
    '/parent/profile': { hue: 'blue', eyebrow: 'Account' },
};

function match(href: string): string | undefined {
    const path = href.split('?')[0];
    return Object.keys(PAGES)
        .filter((route) => path === route || path.startsWith(`${route}/`))
        .sort((a, b) => b.length - a.length)[0];
}

/** The colour of the section a link points into (query strings ignored). */
export function hueForHref(href: string, fallback: Hue = 'blue'): Hue {
    const key = match(href);
    return key ? PAGES[key].hue : fallback;
}

/** A screen's own identity, for its header; only for the exact route. */
export function pageIdentity(pathname: string): PageIdentity | null {
    return PAGES[pathname] ?? null;
}
