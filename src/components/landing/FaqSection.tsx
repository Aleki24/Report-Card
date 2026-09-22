import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Section, SectionHeader } from './ui/Section';

type Faq = {
  question: string;
  answer: string;
};

const FAQS: Faq[] = [
  {
    question: 'How much does Skulbase cost?',
    answer:
      'One plan: KES 5,000 per term with every module included — unlimited students, unlimited teachers, report cards, attendance, analytics and parent management. No per-learner fees.',
  },
  {
    question: 'Does it support both CBC and 8-4-4?',
    answer:
      'Yes. You set the curriculum per class, and grades follow your own grading scales — CBC performance levels (EE, ME, AE, BE) for junior school, letter grades and aggregates for 8-4-4.',
  },
  {
    question: 'How long does it take to get our school set up?',
    answer:
      'Most schools are running in an afternoon. The guided setup walks you through school details, terms, classes and subjects, and you can import your whole student roll from a spreadsheet.',
  },
  {
    question: 'How do teachers and students get their accounts?',
    answer:
      'Every teacher, student and guardian receives a one-time invite code by SMS or email. They activate once — with Google or a username and password — and land on the portal for their role.',
  },
  {
    question: 'Our teachers still write marks on paper. Is that a problem?',
    answer:
      'Not at all. Marks can be typed into a quick grid, uploaded from CSV, or captured by snapping a photo of a handwritten mark sheet.',
  },
  {
    question: 'How do parents receive results?',
    answer:
      'Report cards download as polished PDFs, and results and announcements can be sent straight to parents by SMS — no app install required on their side.',
  },
];

export default function FaqSection() {
  return (
    <Section id="faq" width="narrow">
      <SectionHeader
        eyebrow="Questions"
        title="Everything you're"
        highlight="wondering about."
        description={
          <>
            Can&apos;t find your answer?{' '}
            <Link
              href="/contact"
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Talk to us
            </Link>
            .
          </>
        }
      />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {FAQS.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground transition-colors duration-200 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-6 [&::-webkit-details-marker]:hidden">
              <span className="text-base">{question}</span>
              <Plus
                aria-hidden
                className="size-5 shrink-0 text-primary transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 md:text-base">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
