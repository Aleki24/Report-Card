import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('subjects');

export default function SubjectsFeaturePage() {
  return <ModulePageLayout slug="subjects" />;
}
