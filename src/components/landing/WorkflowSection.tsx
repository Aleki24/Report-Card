import type { LucideIcon } from 'lucide-react';
import { FileText, Settings, Users } from 'lucide-react';
import { Section, SectionHeader } from './ui/Section';

type Step = {
  icon: LucideIcon;
  title: string;
  duration: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: Settings,
    title: 'Set up your school',
    duration: 'Day one',
    description:
      'A guided setup captures your school profile, academic year, terms, classes, streams, subjects and grading scales — CBC, 8-4-4 or both.',
  },
  {
    icon: Users,
    title: 'Bring everyone in',
    duration: 'Same afternoon',
    description:
      'Import students from a spreadsheet, assign teachers to classes and subjects, and send every person a one-time invite code by SMS or email.',
  },
  {
    icon: FileText,
    title: 'Run the term',
    duration: 'Every day after',
    description:
      'Mark attendance, enter exam marks, then generate report cards and performance analytics for any class in one click.',
  },
];

export default function WorkflowSection() {
  return (
    <Section id="how-it-works">
      <SectionHeader
        eyebrow="How it works"
        title="Up and running"
        highlight="in three steps."
        description="No installation, no training week. If your staff can use a smartphone, they can use Skulbase."
      />

      <div className="relative">
        {/* Connector running behind the step badges on wide screens */}
        <span aria-hidden className="absolute top-12 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 md:block" />

        <ol className="relative grid gap-4 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ icon: Icon, title, duration, description }, idx) => (
            <li
              key={title}
              className="relative flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center transition-shadow duration-300 hover:shadow-lg md:p-8"
            >
              <span className="relative flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <Icon className="size-5" aria-hidden />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-border bg-card font-mono text-xs font-semibold text-foreground">
                  {idx + 1}
                </span>
              </span>
              <span className="text-xs font-semibold tracking-widest text-primary uppercase">{duration}</span>
              <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
