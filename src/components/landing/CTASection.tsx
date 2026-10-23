import { PLAN_FOOTNOTE } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { CtaLink } from './ui/CtaLink';
import { CtaPanel } from './ui/CtaPanel';
import { PhoneShot } from './ui/ProductShot';

type FloatingShot = { src: string; alt: string; className: string };

// Phones pinned to the card's corners on large screens: the teacher's marks
// and the parent's view, the two ends of what the school runs here.
const FLOATING_SHOTS: FloatingShot[] = [
  {
    src: '/manual/mobile-teacher-marks.jpg',
    alt: 'A teacher entering Grade 7 Mathematics marks on a phone',
    className: '-top-10 right-[4%] w-32 rotate-6',
  },
  {
    src: '/manual/mobile-parent.jpg',
    alt: 'A parent viewing their child’s results, fees and bus on a phone',
    className: '-bottom-12 left-[4%] w-28 -rotate-6 [animation-delay:2s]',
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
      footnote={PLAN_FOOTNOTE}
      decoration={FLOATING_SHOTS.map((shot) => (
        <div key={shot.src} className={cn('absolute hidden animate-float opacity-95 xl:block', shot.className)}>
          <PhoneShot src={shot.src} alt={shot.alt} sizes="128px" />
        </div>
      ))}
    />
  );
}
