import Link from 'next/link';
import Image from 'next/image';
import { Wordmark } from '@/components/Wordmark';

type FooterLink = { label: string; href: string };
type FooterGroup = { heading: string; links: FooterLink[] };

const GROUPS: FooterGroup[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Report cards', href: '/features/report-cards' },
      { label: 'Exams & marks', href: '/features/exams' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    heading: 'Get started',
    links: [
      { label: 'Register your school', href: '/signup' },
      { label: 'Activate an invite code', href: '/activate' },
      { label: 'Sign in', href: '/login' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border px-4 py-12 sm:px-6 md:py-16 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex w-fit items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Image src="/images/logo.png" alt="" width={36} height={36} className="rounded-lg object-cover" />
            <Wordmark className="font-heading text-lg font-semibold tracking-tight" />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            The school management system built for Kenyan schools — marks, report cards, attendance and parents in one place.
          </p>
        </div>

        {GROUPS.map((group) => (
          <nav key={group.heading} aria-label={group.heading} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-widest text-foreground uppercase">{group.heading}</h2>
            <ul className="flex flex-col gap-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-9 items-center text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
        <span>
          © {new Date().getFullYear()} <Wordmark className="font-semibold" /> School Management System. All rights reserved.
        </span>
        <span>Built for Kenyan schools 🇰🇪</span>
      </div>
    </footer>
  );
}
