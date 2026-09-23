/**
 * Formatting helpers shared by every screen. Several of these were copied
 * into each screen that needed them; they live here so the wording and
 * number formats match across the app (and the web, which formats KES the
 * same way).
 */

import { colors } from './theme';

/** Same threshold as the backend's PASS_MARK (`src/lib/pass-mark.ts`). */
export const PASS_MARK = 50;

const KES = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function formatCurrency(amount: number): string {
    return KES.format(amount);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
    if (value == null || Number.isNaN(value)) return '—';
    return `${Number(value).toFixed(digits).replace(/\.0+$/, '')}%`;
}

export function getGreeting(hour: number = new Date().getHours()): string {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
    return new Date(value).toLocaleDateString('en-GB', opts);
}

export function formatLongToday(): string {
    return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function getTimeAgo(value: string | Date): string {
    const date = new Date(value);
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(date, { day: 'numeric', month: 'short' });
}

function startOfDay(value: string | Date): number {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export function daysUntil(value: string | Date): number {
    return Math.round((startOfDay(value) - startOfDay(new Date())) / 86_400_000);
}

export function getDueLabel(value: string): string {
    const diff = daysUntil(value);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `Due in ${diff} days`;
}

/** An exam within three days counts as "soon", as on the web dashboard. */
export function isSoon(value: string): boolean {
    const diff = daysUntil(value);
    return diff >= 0 && diff < 3;
}

/** YYYY-MM-DD in local time — `toISOString` would shift the day east of UTC. */
export function toISODate(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function shiftISODate(iso: string, deltaDays: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    return toISODate(new Date(y, m - 1, d + deltaDays));
}

/** Parses YYYY-MM-DD as a local date (not UTC midnight). */
export function parseISODate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function isOverdue(dueDate: string | null | undefined, balance: number): boolean {
    if (!dueDate || balance <= 0) return false;
    const due = parseISODate(dueDate.slice(0, 10));
    due.setHours(23, 59, 59, 999);
    return due.getTime() < Date.now();
}

export function fullName(person: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
    return `${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || '—';
}

export function initials(person: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
    return `${person?.first_name?.[0] ?? ''}${person?.last_name?.[0] ?? ''}`.toUpperCase() || '—';
}

export type Tone = 'success' | 'warning' | 'danger' | 'muted';

/**
 * Pass-rate tone, matching the web: red is reserved for a result that needs
 * attention (under 40% of learners passing), amber is "room to improve".
 */
export function passRateTone(rate: number | null | undefined): Tone {
    if (rate == null) return 'muted';
    if (rate >= 70) return 'success';
    if (rate >= 40) return 'warning';
    return 'danger';
}

export function passRateLabel(rate: number | null | undefined): string {
    const tone = passRateTone(rate);
    if (tone === 'success') return 'On track';
    if (tone === 'warning') return 'Room to improve';
    if (tone === 'danger') return 'Needs attention';
    return 'No marks yet';
}

export const TONE_COLORS: Record<Tone, string> = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    muted: colors.muted,
};

/** Colour for a single mark: pass or fail against PASS_MARK. */
export function scoreColor(pct: number | null | undefined): string {
    if (pct == null) return colors.muted;
    return pct >= PASS_MARK ? colors.success : colors.danger;
}

const CURRICULUM_SHORT: Record<string, string> = { CBC: 'CBC', '844': '8-4-4' };

export function shortCurriculumLabel(code: string | null | undefined): string | null {
    const trimmed = (code ?? '').trim();
    return trimmed ? CURRICULUM_SHORT[trimmed] ?? trimmed : null;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
    return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}
