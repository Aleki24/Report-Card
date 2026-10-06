import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { Section } from '@/components/landing/ui/Section';
import { LegalDocument, type LegalSection } from '@/components/landing/LegalDocument';
import { CONTACT_DETAILS } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Privacy policy · Skulbase',
  description: 'What Skulbase collects, why, who it is shared with, and how to delete your account.',
};

const SUPPORT = <a href={`mailto:${CONTACT_DETAILS.email}`}>{CONTACT_DETAILS.email}</a>;

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          Skulbase is a school management system for Kenyan schools, on the web at skulbase.com and in the Skulbase
          mobile app. This policy covers both. Schools sign up and invite their staff, learners and parents; the school
          decides what is recorded about its learners and is responsible for that data, and Skulbase processes it on the
          school’s behalf.
        </p>
        <p>Questions about this policy: {SUPPORT} or {CONTACT_DETAILS.phoneDisplay}.</p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <ul>
        <li><strong>Account details:</strong> name, email address, phone number, password (held by our sign-in provider, never by us) and, if you use it, your Google account’s name and email.</li>
        <li><strong>School records:</strong> what the school enters — classes, admission numbers, exam marks, report cards, attendance, timetables, fees and payments, and, where the school uses those modules, boarding, health, discipline, transport, library and leave records.</li>
        <li><strong>Photos and files</strong> you choose to upload, such as profile photos and scanned exam papers.</li>
        <li><strong>Location</strong>, only on the bus driver’s screen while a trip is running, so parents can see the bus. It is never collected in the background or from other users.</li>
        <li><strong>Payment details</strong> for M-Pesa and Pesapal fee payments: phone number, amount and receipt number. Card details go straight to Pesapal and never reach us.</li>
        <li><strong>Technical data</strong> needed to run the service: sign-in sessions. If the app crashes, the crash details stay on your phone unless you choose to send them to us.</li>
      </ul>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: (
      <ul>
        <li>To run the school features you and your school use: marks, report cards, attendance, fees, messages to parents.</li>
        <li>To sign you in and keep your account secure.</li>
        <li>To send messages the school asks us to send (email, SMS, WhatsApp) and service messages about your account.</li>
        <li>To fix problems and improve the service.</li>
      </ul>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>We do not sell personal data or use it for advertising. We share it only with the services that run Skulbase, each bound to protect it:</p>
        <ul>
          <li>Clerk (sign-in), Supabase (database and file storage), Vercel (hosting).</li>
          <li>Resend (email), Africa’s Talking (SMS) and Meta WhatsApp (messages).</li>
          <li>Safaricom M-Pesa and Pesapal (fee payments).</li>
          <li>Anthropic, when a school uses AI features such as reading a scanned exam paper; the content is processed to produce the result and is not used to train models.</li>
        </ul>
        <p>Inside a school, people see what their role allows: admins and teachers see their school’s records, parents see their own children, learners see their own results. We may disclose data where the law requires it.</p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Learners and children',
    body: (
      <p>
        Learners’ records are created by their school. A learner’s account is opened with an invite code from the school,
        and parents see their children through the parent portal. Schools are responsible for any consent their learners
        and parents need to give. Parents may ask the school, or us, to correct or delete their child’s data.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security and storage',
    body: (
      <p>
        Data is encrypted in transit (HTTPS) and at rest, payment credentials a school saves are encrypted again by us,
        and access is limited by role. No system is perfectly secure, but we work to protect your data and will tell
        affected schools promptly about any breach.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <p>
        We keep data while the school uses Skulbase. When you delete your account, your sign-in and the records that are
        only yours are deleted straight away. Records you made for the school stay with it, no longer linked to you.
        When a school asks to close its account, its data is deleted within 90 days, apart from what the law requires us to keep.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights and deleting your account',
    body: (
      <>
        <p>
          Under Kenya’s Data Protection Act, 2019 you may see, correct, or delete your personal data and object to how it
          is used. Ask your school, or contact us at {SUPPORT}.
        </p>
        <p>
          <strong>Delete your account</strong> at any time: in the app, open Profile → Delete account, or use the{' '}
          <Link href="/delete-account">account deletion page</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: <p>If we change this policy we will update the date above, and tell schools by email about significant changes.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <PageHero
        icon={ShieldCheck}
        eyebrow="Privacy"
        title="Privacy"
        highlight="policy."
        description="What Skulbase collects, why, who it is shared with, and how to delete your account."
      />
      <Section width="narrow" className="pt-0 md:pt-0">
        <LegalDocument updated="3 October 2026" sections={SECTIONS} />
      </Section>
    </MarketingShell>
  );
}
