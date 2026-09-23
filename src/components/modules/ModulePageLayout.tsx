import { getModuleBySlug, isFullModule } from '@/lib/modules';
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

/** The public feature page for one module, or a placeholder for one still to come. */
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

  if (!isFullModule(mod)) {
    return (
      <MarketingShell>
        <PageHero
          icon={mod.icon}
          eyebrow="Coming soon"
          title={mod.title}
          description={mod.description}
          actions={<CtaLink href="/features" variant="outline">See what&apos;s live today</CtaLink>}
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
