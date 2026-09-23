/** Report card templates, as in the web's `src/lib/pdf/templateMeta.ts`. */
export const REPORT_TEMPLATES = [
    { value: 'classic', label: 'Classic', hint: 'Navy & orange, performance graph' },
    { value: 'modern', label: 'Modern', hint: 'Stat tiles, grade pills' },
    { value: 'minimal', label: 'Minimal', hint: 'Ink-friendly letterhead' },
    { value: 'progress', label: 'Progress', hint: 'Per-paper columns, signatures' },
] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATES)[number]['value'];

export const DEFAULT_TEMPLATE: ReportTemplateId = 'classic';

/** The API treats a missing template as the default, so only send others. */
export function templateParam(template: ReportTemplateId): ReportTemplateId | null {
    return template === DEFAULT_TEMPLATE ? null : template;
}
