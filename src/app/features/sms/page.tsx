import ModulePageLayout from '@/components/modules/ModulePageLayout';
import { moduleMetadata } from '@/lib/modules';

export const metadata = moduleMetadata('sms');

export default function SmsFeaturePage() {
  return <ModulePageLayout slug="sms" />;
}
