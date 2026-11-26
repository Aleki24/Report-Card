import { Section, SectionHeader } from './ui/Section';
import { ContactPanel } from './ContactPanel';

/** Reach the owner from the landing page itself: email, call, WhatsApp or the form. */
export default function ContactSection() {
  return (
    <Section id="contact">
      <SectionHeader eyebrow="Talk to us" title="Interested?" highlight="Get in touch." />
      <ContactPanel />
    </Section>
  );
}
