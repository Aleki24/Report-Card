import type { Metadata } from 'next';
import { Wordmark } from '@/components/Wordmark';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section } from '@/components/landing/ui/Section';
import { ContactPanel } from '@/components/landing/ContactPanel';

export const metadata: Metadata = {
  title: 'Contact us · Skulbase',
  description: 'Questions about Skulbase, or ready to bring it to your school? Get in touch.',
};

/**
 * The public contact page, on the same frame and primitives as the rest of
 * the marketing site; it used to style every element inline.
 */
export default function ContactPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Get in touch"
        title="Contact"
        highlight="us."
        description={<>Questions about <Wordmark />, or ready to bring it to your school? We&apos;d love to hear from you.</>}
      />

      <Section className="pt-0 md:pt-0">
        <ContactPanel />
      </Section>
    </MarketingShell>
  );
}
