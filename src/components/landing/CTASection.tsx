import Image from 'next/image';
import { cn } from '@/lib/utils';
import { CtaLink } from './ui/CtaLink';
import { CtaPanel } from './ui/CtaPanel';

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
    <CtaPanel
      id="get-started"
      eyebrow="Ready when you are"
      title="This term, run your whole school"
      highlight="from one dashboard."
      description="Set up your school with the guided wizard, invite staff and students with one-time codes, and manage people, exams, attendance, report cards and parent updates in one place — no more scattered spreadsheets."
      actions={
        <>
          <CtaLink href="/signup">Register Your School</CtaLink>
          <CtaLink href="/activate" variant="outline" className="bg-transparent">
            Join with Invite Code
          </CtaLink>
        </>
      }
      footnote="KES 5,000 per term · every module included"
      decoration={FLOATING_ASSETS.map((asset) => (
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
    />
  );
}
