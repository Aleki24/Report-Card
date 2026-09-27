import { getModuleBySlug } from '@/lib/modules';
import { MarketingShell } from '@/components/landing/ui/MarketingShell';
import { PageHero } from '@/components/landing/ui/PageHero';
import { CtaLink } from '@/components/landing/ui/CtaLink';
import ModuleHero from './ModuleHero';
import ModuleFeatureGrid from './ModuleFeatureGrid';
import ModuleWorkflow from './ModuleWorkflow';
import ModuleBenefits from './ModuleBenefits';
import ModuleCTA from './ModuleCTA';

interface ModulePageLayoutProps {
  slug: string;
}

/** The public feature page for one module. */
export default function ModulePageLayout({ slug }: ModulePageLayoutProps) {
  const mod = getModuleBySlug(slug);

  if (!mod) {
    return (
      <MarketingShell>
        <PageHero
          eyebrow="Features"
          title="Module not found"
          description={<>There is no module called &ldquo;{slug}&rdquo;.</>}
          actions={<CtaLink href="/features" variant="outline">All Features</CtaLink>}
        />
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <ModuleHero module={mod} />
      <ModuleFeatureGrid features={mod.features} />
      <ModuleWorkflow steps={mod.workflow} />
      <ModuleBenefits benefits={mod.benefits} />
      <ModuleCTA module={mod} />
    </MarketingShell>
  );
}
