import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('attendance');

export default function AttendanceFeaturePage() {
  return <ModulePageLayout slug="attendance" />;
}
