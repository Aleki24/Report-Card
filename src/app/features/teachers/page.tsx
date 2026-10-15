import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('teachers');

export default function TeachersFeaturePage() {
  return <ModulePageLayout slug="teachers" />;
}
