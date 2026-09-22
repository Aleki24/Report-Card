import Image from 'next/image';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CtaLink } from './ui/CtaLink';
import { Eyebrow, Section } from './ui/Section';

type FloatingAsset = { src: string; alt: string; className: string };

// Decorative tiles pinned to the card's corners on large screens.
const FLOATING_ASSETS: FloatingAsset[] = [
  {
    src: '/images/empty_state.png',
    alt: 'Holographic school records folder',
    className: '-top-7 right-[4%] size-36 rotate-8 opacity-90',
  },
  {
    src: '/images/dashboard_hero.png',
    alt: 'Abstract glass geometric shapes',
    className: '-bottom-8 left-[5%] size-31 -rotate-7 opacity-85 [animation-delay:2s]',
  },
];

export default function CTASection() {
  return (
    <Section id="get-started">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-background shadow-2xl shadow-black/5 dark:shadow-black/50">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-accent-glow),transparent_60%)]" />

        {FLOATING_ASSETS.map((asset) => (
          <div
            key={asset.src}
            className={cn(
              'absolute hidden animate-float overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/40 lg:block',
              asset.className,
            )}
          >
            <Image src={asset.src} alt={asset.alt} fill sizes="144px" className="object-cover" />
          </div>
        ))}

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-12 text-center md:px-12 md:py-20">
          <Eyebrow leading={<Award className="size-4" aria-hidden />}>Ready when you are</Eyebrow>

          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            This term, run your whole school <span className="text-primary italic">from one dashboard.</span>
          </h2>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Set up your school with the guided wizard, invite staff and students with one-time codes, and manage people,
            exams, attendance, report cards and parent updates in one place — no more scattered spreadsheets.
          </p>

          <div className="mt-4 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
            <CtaLink href="/signup">Register Your School</CtaLink>
            <CtaLink href="/activate" variant="outline" className="bg-transparent">
              Join with Invite Code
            </CtaLink>
          </div>

          <p className="text-sm text-muted-foreground">KES 5,000 per term · every module included</p>
        </div>
      </div>
    </Section>
  );
}
