import type { Metadata } from 'next';
import Link from 'next/link';
import { UserX } from 'lucide-react';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section } from '@/components/landing/ui/Section';
import { DeleteAccountPanel } from '@/components/account/DeleteAccountPanel';

export const metadata: Metadata = {
  title: 'Delete your account · Skulbase',
  description: 'Delete your Skulbase account and the data linked to it.',
};

export default function DeleteAccountPage() {
  return (
    <MarketingShell>
      <PageHero
        icon={UserX}
        eyebrow="Your data"
        title="Delete your"
        highlight="account."
        description={<>Remove your Skulbase account and the data that is only yours. See the <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">privacy policy</Link> for details.</>}
      />
      <Section width="narrow" className="pt-0 md:pt-0">
        <DeleteAccountPanel />
      </Section>
    </MarketingShell>
  );
}
