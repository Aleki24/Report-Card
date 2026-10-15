import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('fees');

export default function FeesFeaturePage() {
  return <ModulePageLayout slug="fees" />;
}
