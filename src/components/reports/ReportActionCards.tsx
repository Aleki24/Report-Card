"use client";

import React from 'react';
import { BarChart3, FileText, Layers, Loader2, MessageSquare, Table2, type LucideIcon } from 'lucide-react';
import { StepHeading } from '@/components/ui/StepHeading';
import { TONES, type Tone } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface ReportActionCardsProps {
  isConfigured: boolean;
  generating: boolean;
  generatingMarkSheet: boolean;
  onSelectStudent: () => void;
  onBulkGenerate: () => void;
  onTermComparison: () => void;
  onMarkSheet: () => void;
  onSMS: () => void;
}

interface Action {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description: string;
  cta: string;
  busy?: boolean;
  primary?: boolean;
  /** Works without a class, year and term chosen. */
  alwaysAvailable?: boolean;
  onClick: () => void;
}

/** Step two: what can be made from the chosen scope, one colour per action. */
export function ReportActionCards({
  isConfigured, generating, generatingMarkSheet,
  onSelectStudent, onBulkGenerate, onTermComparison, onMarkSheet, onSMS,
}: ReportActionCardsProps) {
  const actions: Action[] = [
    { key: 'bulk', icon: Layers, tone: TONES.blue, title: 'Whole class', description: 'Every report card for the class in one download.', cta: generating ? 'Preparing…' : 'Generate & download', busy: generating, primary: true, onClick: onBulkGenerate },
    { key: 'one', icon: FileText, tone: TONES.violet, title: 'One learner', description: 'A single learner’s report card.', cta: 'Choose learner', onClick: onSelectStudent },
    { key: 'sheet', icon: Table2, tone: TONES.emerald, title: 'Mark sheet', description: 'Ranked subject scores for the whole class.', cta: generatingMarkSheet ? 'Preparing…' : 'Download mark sheet', busy: generatingMarkSheet, onClick: onMarkSheet },
    { key: 'sms', icon: MessageSquare, tone: TONES.amber, title: 'SMS to parents', description: 'Text each guardian their child’s results.', cta: 'Send SMS', onClick: onSMS },
    { key: 'compare', icon: BarChart3, tone: TONES.rose, title: 'Compare terms', description: 'How the class moved across terms.', cta: 'Compare', alwaysAvailable: true, onClick: onTermComparison },
  ];

  return (
    <section aria-labelledby="report-actions-heading">
      <div id="report-actions-heading" className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <StepHeading step={2} title="Generate & share" />
        {!isConfigured && <span className="text-xs text-muted-foreground">Choose the class, term and exam above to unlock these.</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {actions.map(({ key, icon: Icon, tone, title, description, cta, busy, primary, alwaysAvailable, onClick }) => {
          const locked = !isConfigured && !alwaysAvailable;
          return (
            <div
              key={key}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all',
                locked ? 'opacity-55' : cn('hover:-translate-y-0.5 hover:shadow-md', tone.hover),
              )}
            >
              <span className={cn('flex size-10 items-center justify-center rounded-xl', tone.tile)} aria-hidden>
                <Icon className="size-5" />
              </span>
              <div className="flex-1">
                <h4 className="mb-0.5 text-sm font-semibold">{title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
              <button
                type="button"
                onClick={onClick}
                disabled={locked || busy}
                title={locked ? 'Choose the class, term and exam above first' : undefined}
                className={cn(primary ? 'btn-primary' : 'btn-secondary', 'h-9 w-full text-sm disabled:pointer-events-none disabled:opacity-60')}
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {cta}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
