import { cn } from '@/lib/utils';
import { Section, SectionHeader } from '@/components/landing/ui/Section';
import { TONES, type Tone } from '@/components/landing/ui/tones';

interface ModuleWorkflowProps {
  steps: string[];
  title?: string;
}

/** Each step gets the next accent so a long workflow still reads as a sequence. */
const STEP_TONES: Tone[] = ['primary', 'positive', 'caution', 'violet'];

export default function ModuleWorkflow({ steps, title = 'From setup to results' }: ModuleWorkflowProps) {
  return (
    <Section aria-label="How it works">
      <SectionHeader eyebrow="How it works" title={title} />
      <ol className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
        {steps.map((step, idx) => {
          const tone = TONES[STEP_TONES[idx % STEP_TONES.length]];
          return (
            <li key={step} className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <span className="flex items-center gap-3">
                <span className={cn('flex size-9 items-center justify-center rounded-xl border font-mono text-sm font-bold', tone.tile, tone.text)}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span aria-hidden className={cn('h-px flex-1 bg-gradient-to-r to-transparent opacity-40', tone.bar)} />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">{step}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
