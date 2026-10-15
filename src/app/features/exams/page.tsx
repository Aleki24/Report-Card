import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('exams');

export default function ExamsFeaturePage() {
  return <ModulePageLayout slug="exams" />;
}
