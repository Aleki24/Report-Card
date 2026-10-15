import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('classes');

export default function ClassesFeaturePage() {
  return <ModulePageLayout slug="classes" />;
}
