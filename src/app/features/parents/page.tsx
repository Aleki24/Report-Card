import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('parents');

export default function ParentsFeaturePage() {
  return <ModulePageLayout slug="parents" />;
}
