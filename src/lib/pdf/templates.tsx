import React from 'react';
import { HeritageLayout } from './templates/heritage';
import { AuroraLayout } from './templates/aurora';
import { EditorialLayout } from './templates/editorial';
import { GrowthLayout } from './templates/growth';
import { DEFAULT_TEMPLATE, isReportTemplateId, type ReportTemplateId } from './templateMeta';
import type { ReportCardData } from '../pdfGenerator';

export { DEFAULT_TEMPLATE, REPORT_TEMPLATES, isReportTemplateId, type ReportTemplateId } from './templateMeta';

export type LayoutProps = { data: ReportCardData; qrCodeDataUri?: string };

/* Template ids are stored in school settings, so they stay as they were;
   only the designs behind them changed. */
const layouts: Record<ReportTemplateId, React.ComponentType<LayoutProps>> = {
    classic: HeritageLayout,
    modern: AuroraLayout,
    minimal: EditorialLayout,
    progress: GrowthLayout,
};

export function getTemplateLayout(template?: string): React.ComponentType<LayoutProps> {
    return layouts[isReportTemplateId(template) ? template : DEFAULT_TEMPLATE];
}
