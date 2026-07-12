import React from 'react';
import { ReportCardLayout } from './ReportCardLayout';
import { ReportCardLayoutModern } from './ReportCardLayoutModern';
import { ReportCardLayoutMinimal } from './ReportCardLayoutMinimal';
import { ReportCardLayoutProgress } from './ReportCardLayoutProgress';
import { DEFAULT_TEMPLATE, isReportTemplateId, type ReportTemplateId } from './templateMeta';
import type { ReportCardData } from '../pdfGenerator';

export { DEFAULT_TEMPLATE, REPORT_TEMPLATES, isReportTemplateId, type ReportTemplateId } from './templateMeta';

type LayoutProps = { data: ReportCardData; qrCodeDataUri?: string };

const layouts: Record<ReportTemplateId, React.ComponentType<LayoutProps>> = {
    classic: ReportCardLayout,
    modern: ReportCardLayoutModern,
    minimal: ReportCardLayoutMinimal,
    progress: ReportCardLayoutProgress,
};

export function getTemplateLayout(template?: string): React.ComponentType<LayoutProps> {
    return layouts[isReportTemplateId(template) ? template : DEFAULT_TEMPLATE];
}

/** The classic template draws its own navy page bars; the others are full-bleed. */
export function templateHasPageBars(template?: string): boolean {
    return !isReportTemplateId(template) || template === 'classic';
}
