/**
 * Report card template metadata. Deliberately free of @react-pdf/renderer
 * imports so UI components can list templates without bundling the PDF engine.
 * The id → layout mapping lives in ./templates.tsx. Ids are stored in school
 * settings, so they keep their original names while the designs behind them change.
 */

export type ReportTemplateId = 'classic' | 'modern' | 'minimal' | 'progress';

export const DEFAULT_TEMPLATE: ReportTemplateId = 'classic';

export const REPORT_TEMPLATES: { id: ReportTemplateId; name: string; description: string }[] = [
    { id: 'classic', name: 'Heritage', description: 'Formal navy & gold with a grade seal, class comparison and grading scale' },
    { id: 'modern', name: 'Aurora', description: 'Indigo & violet dashboard with score ring, stat tiles and grade pills' },
    { id: 'minimal', name: 'Editorial', description: 'Black & white, large serif figures, ink-friendly for any printer' },
    { id: 'progress', name: 'Growth', description: 'Teal progress story: this exam vs the last, subject by subject' },
];

export function isReportTemplateId(value: unknown): value is ReportTemplateId {
    return value === 'classic' || value === 'modern' || value === 'minimal' || value === 'progress';
}
