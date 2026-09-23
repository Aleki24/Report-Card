import { Section, SectionHeader } from '@/components/landing/ui/Section';
import CheckCardList from './CheckCardList';

interface ModuleBenefitsProps {
  benefits: string[];
  title?: string;
}

export default function ModuleBenefits({ benefits, title = 'Benefits for your school' }: ModuleBenefitsProps) {
  return (
    <Section width="narrow" aria-label="Benefits">
      <SectionHeader eyebrow="Why it matters" title={title} />
      <CheckCardList items={benefits} tone="positive" columns={1} />
    </Section>
  );
}
