"use client";

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, Send, XCircle } from 'lucide-react';
import { SearchBox } from '@/components/ui/SearchBox';
import { TONES } from '@/components/ui/tones';
import { cn } from '@/lib/utils';
import { matchesLearner, type RosterLearner } from '@/lib/reports/class-roster';
import { LearnerAvatar, ReportDialog } from './ReportDialog';

export interface SMSResult { sent: number; failed: number; skipped: number; failureReasons: string[] }

interface SMSModalProps {
  onClose: () => void;
  classLabel: string;
  /** "Term 2 End Term 2026": the exam the texts report. */
  examLabel: string;
  /** The chosen class's learners; null while loading. */
  learners: RosterLearner[] | null;
  sending: boolean;
  result: SMSResult | null;
  /** Resolves true when at least one text went out. */
  onSend: (studentIds: string[]) => Promise<boolean>;
  messagePreview: string;
}

/** Rough Africa's Talking price per SMS in Kenya, for the estimate only. */
const KES_PER_SMS = 0.8;

export function SMSModal({ onClose, classLabel, examLabel, learners, sending, result, onSend, messagePreview }: SMSModalProps) {
  const [search, setSearch] = useState('');
  /** null until the user changes it: everyone with a phone is ticked. */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [confirming, setConfirming] = useState(false);

  const reachable = useMemo(() => (learners ?? []).filter(l => l.guardian_phone), [learners]);
  const missingPhone = (learners?.length ?? 0) - reachable.length;
  const shown = useMemo(() => (learners ?? []).filter(l => matchesLearner(l, search)), [learners, search]);
  const selected = useMemo(() => picked ?? new Set(reachable.map(l => l.id)), [picked, reachable]);

  // Any change to the selection asks for confirmation again.
  const changeSelection = (update: (next: Set<string>) => void) => {
    const next = new Set(selected);
    update(next);
    setPicked(next);
    setConfirming(false);
  };
  const toggle = (id: string) => changeSelection(next => { if (next.has(id)) next.delete(id); else next.add(id); });
  const shownReachable = shown.filter(l => l.guardian_phone);
  const selectShown = (on: boolean) => changeSelection(next => { for (const l of shownReachable) { if (on) next.add(l.id); else next.delete(l.id); } });

  const count = selected.size;
  const plural = count === 1 ? '' : 's';

  const send = async () => {
    // Texts cost money and cannot be recalled: the first press asks.
    if (!confirming) { setConfirming(true); return; }
    const delivered = await onSend([...selected]);
    // Clear the ticks so a second press cannot text the same parents twice.
    if (delivered) setPicked(new Set());
    setConfirming(false);
  };

  return (
    <ReportDialog
      title="Text results to parents"
      subtitle={<><strong className="text-foreground">{classLabel}</strong> · {examLabel}</>}
      icon={MessageSquare}
      tone={TONES.amber}
      onClose={onClose}
      maxWidth="max-w-2xl"
      toolbar={
        <div className="space-y-3">
          {missingPhone > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {missingPhone} learner{missingPhone === 1 ? ' has' : 's have'} no guardian phone. Add one on the People page to include them.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchBox value={search} onChange={setSearch} placeholder="Search by name or admission number" className="flex-1" />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary h-9 flex-1 text-xs sm:flex-none" onClick={() => selectShown(true)} disabled={shownReachable.length === 0}>Select all</button>
              <button type="button" className="btn-secondary h-9 flex-1 text-xs sm:flex-none" onClick={() => selectShown(false)} disabled={count === 0}>Clear</button>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="space-y-3">
          {result && (
            <div role="status" className={cn('rounded-xl border p-3 text-xs', result.failed > 0 || result.sent === 0 ? 'border-destructive/25 bg-destructive/5 text-destructive' : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400')}>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" aria-hidden />{result.sent} sent</span>
                <span className="inline-flex items-center gap-1"><XCircle className="size-3.5" aria-hidden />{result.failed} failed</span>
                {result.skipped > 0 && <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3.5" aria-hidden />{result.skipped} skipped</span>}
              </p>
              {result.failureReasons.length > 0 && (
                <ul className="mt-2 list-disc pl-4">{result.failureReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
              )}
            </div>
          )}
          {count > 0 && (
            <details className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-muted-foreground">Example message</summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{messagePreview}</pre>
            </details>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {count} parent{plural} selected{count > 0 && <> · about KES {(count * KES_PER_SMS).toFixed(1)}</>}
            </p>
            <button type="button" className={cn('h-10 text-sm', confirming ? 'btn-primary bg-amber-600 hover:bg-amber-700' : 'btn-primary')} onClick={() => void send()} disabled={sending || count === 0}>
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {sending ? 'Sending…' : confirming ? `Confirm: send ${count} text${plural}` : `Send to ${count} parent${plural}`}
            </button>
          </div>
        </div>
      }
    >
      {learners === null ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading learners…</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{search ? 'No learner matches that search.' : 'This class has no learners yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map(l => {
            const hasPhone = Boolean(l.guardian_phone);
            const checked = selected.has(l.id);
            return (
              <li key={l.id}>
                <label className={cn('flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 transition-colors', hasPhone ? 'cursor-pointer' : 'cursor-not-allowed opacity-55', checked ? 'bg-amber-500/[0.07]' : hasPhone && 'hover:bg-muted')}>
                  <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={checked} disabled={!hasPhone} onChange={() => toggle(l.id)} />
                  <LearnerAvatar initials={l.initials} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[l.admission_number, l.guardian_name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-mono text-[11px]', hasPhone ? 'text-muted-foreground' : 'text-destructive')}>
                    {l.guardian_phone ?? 'No phone'}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </ReportDialog>
  );
}
