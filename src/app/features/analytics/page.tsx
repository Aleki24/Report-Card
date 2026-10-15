import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('analytics');

export default function AnalyticsFeaturePage() {
  return <ModulePageLayout slug="analytics" />;
}
