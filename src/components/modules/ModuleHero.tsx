import type { Module } from '@/lib/modules';
import { Wordmark } from '@/components/Wordmark';
import { CtaLink } from '@/components/landing/ui/CtaLink';
import { PageHero } from '@/components/landing/ui/PageHero';

interface ModuleHeroProps {
  module: Module;
}

export default function ModuleHero({ module }: ModuleHeroProps) {
  return (
    <PageHero
      icon={module.icon}
      eyebrow={<><Wordmark /> module</>}
      title={module.title}
      description={module.longDescription}
      actions={
        <>
          <CtaLink href={module.dashboardHref}>Open {module.shortTitle} Dashboard</CtaLink>
          <CtaLink href="/features" variant="outline">All Features</CtaLink>
        </>
      }
    />
  );
}
