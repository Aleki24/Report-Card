import { Mail, MessageCircle, Phone, type LucideIcon } from 'lucide-react';
import { ContactForm } from '@/components/landing/ContactForm';
import { CONTACT_DETAILS } from '@/lib/contact';
import { cn } from '@/lib/utils';

interface ContactItem { icon: LucideIcon; label: string; value: string; href: string; external?: boolean; wide?: boolean }

const CONTACTS: readonly ContactItem[] = [
  { icon: Mail, label: 'Email', value: CONTACT_DETAILS.email, href: `mailto:${CONTACT_DETAILS.email}`, wide: true },
  { icon: Phone, label: 'Call', value: CONTACT_DETAILS.phoneDisplay, href: CONTACT_DETAILS.phoneHref },
  { icon: MessageCircle, label: 'WhatsApp', value: CONTACT_DETAILS.phoneDisplay, href: CONTACT_DETAILS.whatsappHref, external: true },
];

/**
 * How to reach the owner: email, call, WhatsApp, and the form that emails and
 * texts them. Shared by the landing page's contact section and /contact.
 */
export function ContactPanel({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto grid max-w-5xl gap-6 lg:grid-cols-5 lg:gap-10', className)}>
      {/* Phones: email across, call and WhatsApp side by side, so the form is near. */}
      <ul className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-1 lg:content-start">
        {CONTACTS.map(({ icon: Icon, label, value, href, external, wide }) => {
          const body = (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-10" aria-hidden>
                <Icon className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</span>
                <span className="block truncate text-sm font-medium text-foreground sm:text-[15px]">{value}</span>
              </span>
            </>
          );
          return (
            <li key={label} className={cn(wide && 'col-span-2 lg:col-span-1')}>
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 no-underline transition-colors hover:border-primary/60 sm:gap-4 sm:p-5"
              >
                {body}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8 lg:col-span-3">
        <ContactForm />
      </div>
    </div>
  );
}
