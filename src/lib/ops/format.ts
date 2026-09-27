/** Display formatting shared by every operations page. */
import type { PersonName, StudentEmbed } from './resource';

const KES = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 });

export const money = (value: number | string | null | undefined) => KES.format(Number(value ?? 0));

export const personName = (p: PersonName | PersonName[] | null | undefined) => {
    const one = Array.isArray(p) ? p[0] : p;
    return one ? `${one.first_name} ${one.last_name}`.trim() : '—';
};

export const studentName = (s: StudentEmbed | StudentEmbed[] | null | undefined) => {
    const one = Array.isArray(s) ? s[0] : s;
    return one ? personName(one.user) : '—';
};

export const admissionNo = (s: StudentEmbed | StudentEmbed[] | null | undefined) => {
    const one = Array.isArray(s) ? s[0] : s;
    return one?.admission_number ?? '';
};

export const date = (value: string | null | undefined) =>
    value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** `SICK_BAY` → `Sick bay`. */
export const humanize = (value: string | null | undefined) =>
    value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

export const today = () => new Date().toISOString().slice(0, 10);

/** Whole days from today to `value` (negative once past). */
export const daysUntil = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const ms = new Date(`${value}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime();
    return Math.round(ms / 86_400_000);
};

/** `datetime-local` value for an ISO timestamp, in the browser's zone. */
export const toLocalInput = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
