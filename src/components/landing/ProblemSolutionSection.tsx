import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Calculator, FileSpreadsheet, MessageSquareText, Printer, X, Check } from 'lucide-react';
import { Section, SectionHeader } from './ui/Section';

type Comparison = {
  icon: LucideIcon;
  task: string;
  before: string;
  after: string;
};

// Each row pairs a real end-of-term chore with the module that removes it.
const COMPARISONS: Comparison[] = [
  {
    icon: FileSpreadsheet,
    task: 'Collecting marks',
    before: 'Paper mark sheets passed between teachers, then retyped into Excel.',
    after: 'Teachers enter marks once — by grid, CSV upload or a photo of the sheet.',
  },
  {
    icon: Calculator,
    task: 'Grading & ranking',
    before: 'Late nights computing averages, grades and positions by hand.',
    after: 'Grades, means and class positions calculated on your CBC or 8-4-4 scale.',
  },
  {
    icon: Printer,
    task: 'Report cards',
    before: 'Filling every report form one learner at a time.',
    after: 'A branded PDF for the whole class, generated in one click.',
  },
  {
    icon: MessageSquareText,
    task: 'Reaching parents',
    before: 'Parents waiting for closing day — or never seeing the results.',
    after: 'Results and announcements delivered to every parent by SMS.',
  },
];

export default function ProblemSolutionSection() {
  return (
    <Section id="why-skulbase">
      <SectionHeader
        eyebrow="Why schools switch"
        title="End of term shouldn't take"
        highlight="two weeks of overtime."
        description="Here is where the hours go today, and what changes when marks, grading and reporting share one system."
      />

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {/* Column labels — desktop only; each row labels itself on mobile */}
        <div className="hidden grid-cols-[minmax(0,14rem)_1fr_auto_1fr] items-center gap-6 border-b border-border bg-muted/40 px-8 py-4 text-xs font-semibold tracking-widest uppercase md:grid">
          <span className="text-muted-foreground">Task</span>
          <span className="text-muted-foreground">The old way</span>
          <span aria-hidden className="w-5" />
          <span className="text-primary">With Skulbase</span>
        </div>

        <ul className="divide-y divide-border">
          {COMPARISONS.map(({ icon: Icon, task, before, after }) => (
            <li
              key={task}
              className="grid gap-4 px-5 py-6 transition-colors duration-200 hover:bg-muted/30 sm:px-8 md:grid-cols-[minmax(0,14rem)_1fr_auto_1fr] md:items-center md:gap-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-heading text-base font-bold text-foreground">{task}</h3>
              </div>

              <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Before" />
                {before}
              </p>

              <ArrowRight className="hidden size-5 text-muted-foreground/60 md:block" aria-hidden />

              <p className="flex items-start gap-2.5 rounded-xl bg-positive/10 p-3 text-sm leading-relaxed font-medium text-foreground md:bg-transparent md:p-0">
                <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-label="With Skulbase" />
                {after}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
