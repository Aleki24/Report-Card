import type { AttendanceStatus } from '@/lib/attendance';

/**
 * Status colours come from the CVD-validated --viz-* theme tokens, the same
 * semantic mapping as the dashboard's attendance chart. Full class strings so
 * Tailwind's scanner sees every one.
 */
export const STATUS_STYLES: Readonly<Record<AttendanceStatus, { short: string; active: string; text: string; bar: string }>> = {
  present: {
    short: 'P',
    active: 'bg-[color-mix(in_srgb,var(--viz-good)_16%,transparent)] text-[var(--viz-good)]',
    text: 'text-[var(--viz-good)]',
    bar: 'bg-[var(--viz-good)]',
  },
  absent: {
    short: 'A',
    active: 'bg-[color-mix(in_srgb,var(--viz-bad)_16%,transparent)] text-[var(--viz-bad)]',
    text: 'text-[var(--viz-bad)]',
    bar: 'bg-[var(--viz-bad)]',
  },
  late: {
    short: 'L',
    active: 'bg-[color-mix(in_srgb,var(--viz-warn)_16%,transparent)] text-[var(--viz-warn)]',
    text: 'text-[var(--viz-warn)]',
    bar: 'bg-[var(--viz-warn)]',
  },
  excused: {
    short: 'E',
    active: 'bg-[color-mix(in_srgb,var(--viz-info)_16%,transparent)] text-[var(--viz-info)]',
    text: 'text-[var(--viz-info)]',
    bar: 'bg-[var(--viz-info)]',
  },
};
