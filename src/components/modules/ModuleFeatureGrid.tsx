import { Section, SectionHeader } from '@/components/landing/ui/Section';
import CheckCardList from './CheckCardList';

interface ModuleFeatureGridProps {
  features: string[];
  title?: string;
}

export default function ModuleFeatureGrid({ features, title = 'Everything you need' }: ModuleFeatureGridProps) {
  return (
    <Section aria-label="Key features">
      <SectionHeader eyebrow="Key features" title={title} />
      <CheckCardList items={features} />
    </Section>
  );
}
