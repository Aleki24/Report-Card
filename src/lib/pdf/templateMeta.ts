/**
 * Report card template metadata. Deliberately free of @react-pdf/renderer
 * imports so UI components can list templates without bundling the PDF engine.
 * The id → layout mapping lives in ./templates.tsx.
 */

export type ReportTemplateId = 'classic' | 'modern' | 'minimal' | 'progress';

export const DEFAULT_TEMPLATE: ReportTemplateId = 'classic';

export const REPORT_TEMPLATES: { id: ReportTemplateId; name: string; description: string }[] = [
    { id: 'classic', name: 'Classic', description: 'Navy & orange with performance graph' },
    { id: 'modern', name: 'Modern', description: 'Indigo accents, stat tiles and grade pills' },
    { id: 'minimal', name: 'Minimal', description: 'Black & white letterhead, ink-friendly' },
    { id: 'progress', name: 'Progress (Teal)', description: 'Teal banner, per-paper columns, category chart & signatures' },
];

export function isReportTemplateId(value: unknown): value is ReportTemplateId {
    return value === 'classic' || value === 'modern' || value === 'minimal' || value === 'progress';
}
