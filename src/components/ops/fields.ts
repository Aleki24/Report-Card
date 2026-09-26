/**
 * Declarative form fields for operations records, and the conversion between
 * a row, the strings a form edits, and the JSON the API validates.
 */
import type { z } from 'zod';
import type { LookupOption, LookupType } from '@/lib/ops/lookups';
import type { RESOURCES, ResourceName } from '@/lib/ops/registry';
import { humanize, toLocalInput } from '@/lib/ops/format';

/** The columns a resource's form may set, taken from its schema. */
export type FieldName<R extends ResourceName> = Extract<keyof z.input<(typeof RESOURCES)[R]['schema']>, string>;

interface BaseField<N extends string> {
    name: N;
    label: string;
    required?: boolean;
    hint?: string;
    span?: 'half' | 'full';
}

export type FieldDef<N extends string = string> = BaseField<N> & (
    | { kind: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'time' | 'email' | 'tel'; placeholder?: string; step?: string }
    | { kind: 'enum'; values: readonly string[]; labels?: Readonly<Record<string, string>> }
    | { kind: 'lookup'; lookup: LookupType; params?: Record<string, string | undefined>; filter?: (o: LookupOption) => boolean }
    | { kind: 'options'; options: readonly LookupOption[] }
    | { kind: 'checkbox' }
    /** Comma-separated numbers, sent as an array (term splits). */
    | { kind: 'numberList'; placeholder?: string }
);

export type FormValues = Record<string, string | boolean>;

/** The label for an enum value: an explicit label, else `SICK_BAY` → `Sick bay`. */
export const enumLabel = (field: { labels?: Readonly<Record<string, string>> }, value: string) => field.labels?.[value] ?? humanize(value);

function toInput(field: FieldDef, raw: unknown): string | boolean {
    if (field.kind === 'checkbox') return raw === true;
    if (raw === null || raw === undefined) return '';
    if (field.kind === 'datetime') return toLocalInput(String(raw));
    if (field.kind === 'date') return String(raw).slice(0, 10);
    if (field.kind === 'time') return String(raw).slice(0, 5);
    if (field.kind === 'numberList' && Array.isArray(raw)) return raw.join(', ');
    return String(raw);
}

export function toFormValues(
    fields: readonly FieldDef[],
    row?: Record<string, unknown> | null,
    defaults?: Readonly<Record<string, string | boolean | undefined>>,
): FormValues {
    return Object.fromEntries(fields.map(f => {
        const raw = row ? row[f.name] : defaults?.[f.name];
        return [f.name, raw === undefined ? (f.kind === 'checkbox' ? false : '') : toInput(f, raw)];
    }));
}

/** What the API receives: numbers as numbers, local times as ISO, blanks as ''. */
export function fromFormValues(fields: readonly FieldDef[], values: FormValues): Record<string, unknown> {
    return Object.fromEntries(fields.map(f => {
        const v = values[f.name];
        if (f.kind === 'checkbox') return [f.name, v === true];
        const s = typeof v === 'string' ? v.trim() : '';
        if (f.kind === 'number') return [f.name, s === '' ? null : Number(s)];
        if (f.kind === 'datetime') return [f.name, s === '' ? '' : new Date(s).toISOString()];
        if (f.kind === 'numberList') return [f.name, s.split(/[,\s]+/).filter(Boolean).map(Number)];
        return [f.name, s];
    }));
}

/** Names of required fields left blank, for a message before sending. */
export function missingRequired(fields: readonly FieldDef[], values: FormValues): string[] {
    return fields.filter(f => f.required && f.kind !== 'checkbox' && String(values[f.name] ?? '').trim() === '').map(f => f.label);
}
