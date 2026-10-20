import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('students');

export default function StudentsFeaturePage() {
  return <ModulePageLayout slug="students" />;
}
