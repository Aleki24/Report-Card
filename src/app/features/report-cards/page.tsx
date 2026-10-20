import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('report-cards');

export default function ReportCardsFeaturePage() {
  return <ModulePageLayout slug="report-cards" />;
}
