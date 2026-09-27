import type { Metadata } from 'next';
import { Mail, MapPin, Phone, type LucideIcon } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section } from '@/components/landing/ui/Section';
import { ContactForm } from '@/components/landing/ContactForm';
import { CONTACT_DETAILS } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Contact us · Skulbase',
  description: 'Questions about Skulbase, or ready to bring it to your school? Get in touch.',
};

interface ContactItem { icon: LucideIcon; label: string; value: string; href?: string }

const CONTACTS: readonly ContactItem[] = [
  { icon: Mail, label: 'Email', value: CONTACT_DETAILS.email, href: `mailto:${CONTACT_DETAILS.email}` },
  { icon: Phone, label: 'Phone', value: CONTACT_DETAILS.phoneDisplay, href: CONTACT_DETAILS.phoneHref },
  { icon: MapPin, label: 'Location', value: CONTACT_DETAILS.location },
];

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
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-5 lg:gap-10">
          <ul className="flex flex-col gap-4 lg:col-span-2">
            {CONTACTS.map(({ icon: Icon, label, value, href }) => {
              const body = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</span>
                    <span className="block truncate text-[15px] font-medium text-foreground">{value}</span>
                  </span>
                </>
              );
              const box = 'flex items-start gap-4 rounded-2xl border border-border/70 bg-card p-5';
              return (
                <li key={label}>
                  {href
                    ? <a href={href} className={`${box} no-underline transition-colors hover:border-primary/60`}>{body}</a>
                    : <div className={box}>{body}</div>}
                </li>
              );
            })}
          </ul>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8 lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </Section>
    </MarketingShell>
  );
}
