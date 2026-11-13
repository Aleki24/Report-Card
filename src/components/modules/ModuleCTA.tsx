import type { Module } from '@/lib/modules';
import { PLAN_FOOTNOTE } from '@/lib/pricing';
import { CtaLink } from '@/components/landing/ui/CtaLink';
import { CtaPanel } from '@/components/landing/ui/CtaPanel';

interface ModuleCTAProps {
  module: Module;
}

export default function ModuleCTA({ module }: ModuleCTAProps) {
  return (
    <CtaPanel
      eyebrow="Ready to get started"
      title="Start using"
      highlight={module.title}
      description={module.description}
      actions={
        <>
          <CtaLink href={module.dashboardHref}>Open {module.shortTitle} Dashboard</CtaLink>
          <CtaLink href="/signup" variant="outline" className="bg-transparent">Register Your School</CtaLink>
        </>
      }
      footnote={PLAN_FOOTNOTE}
    />
  );
}
