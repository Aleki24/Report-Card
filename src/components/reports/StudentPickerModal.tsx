"use client";

import React, { useMemo, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { SearchBox } from '@/components/ui/SearchBox';
import { TONES } from '@/components/ui/tones';
import { matchesLearner, type RosterLearner } from '@/lib/reports/class-roster';
import { LearnerAvatar, ReportDialog } from './ReportDialog';

interface StudentPickerModalProps {
  /** The chosen class's learners; null while loading. */
  learners: RosterLearner[] | null;
  classLabel: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Pick one learner of the chosen class; their card opens in a new tab. */
export function StudentPickerModal({ learners, classLabel, onSelect, onClose }: StudentPickerModalProps) {
  const [search, setSearch] = useState('');
  const shown = useMemo(() => (learners ?? []).filter(l => matchesLearner(l, search)), [learners, search]);

  return (
    <ReportDialog
      title="One learner's report card"
      subtitle={<>From <strong className="text-foreground">{classLabel}</strong>. It opens in a new tab.</>}
      icon={FileText}
      tone={TONES.violet}
      onClose={onClose}
      toolbar={<SearchBox value={search} onChange={setSearch} placeholder="Search by name or admission number" />}
    >
      {learners === null ? (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading learners…</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{search ? 'No learner matches that search.' : 'This class has no learners yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map(l => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => onSelect(l.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LearnerAvatar initials={l.initials} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{l.name}</span>
                  {l.admission_number && <span className="block font-mono text-[11px] text-muted-foreground">{l.admission_number}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ReportDialog>
  );
}
