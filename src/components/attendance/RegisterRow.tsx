"use client";

import React, { memo, useState } from 'react';
import { MessageSquareText, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ATTENDANCE_NOTE_MAX, type AttendanceRosterEntry, type AttendanceStatus } from '@/lib/attendance';
import { StatusPicker } from './StatusPicker';

interface RegisterRowProps {
  entry: AttendanceRosterEntry;
  index: number;
  dirty: boolean;
  onStatus: (id: string, status: AttendanceStatus) => void;
  onNote: (id: string, note: string) => void;
  onRevert: (id: string) => void;
}

/** One student on the register: name, the four statuses, an optional note. */
export const RegisterRow = memo(function RegisterRow({ entry, index, dirty, onStatus, onNote, onRevert }: RegisterRowProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const noteId = `note-${entry.id}`;
  const hasNote = !!entry.notes?.trim();

  return (
    <li className={cn('px-3 py-3 transition-colors sm:px-4', dirty ? 'bg-amber-500/[0.06]' : 'hover:bg-muted/40')}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="hidden w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:block">{index + 1}</span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
              <span className="truncate">{entry.name}</span>
              {dirty && <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">Unsaved</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{entry.admission_number || 'No adm. no.'}</span>
              {hasNote && !noteOpen && <span className="italic"> · {entry.notes}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 sm:flex-none">
            <StatusPicker value={entry.status} onChange={status => onStatus(entry.id, status)} studentName={entry.name} />
          </div>
          <button
            type="button"
            onClick={() => setNoteOpen(open => !open)}
            disabled={!entry.status}
            aria-expanded={noteOpen}
            aria-controls={noteId}
            aria-label={hasNote ? `Edit note for ${entry.name}` : `Add a note for ${entry.name}`}
            title={entry.status ? (hasNote ? 'Edit note' : 'Add a note') : 'Mark the student first'}
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 sm:size-9',
              hasNote || noteOpen ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <MessageSquareText className="size-4" aria-hidden="true" />
          </button>
          {/* Always takes its space so rows don't shift when a change appears. */}
          <button
            type="button"
            onClick={() => onRevert(entry.id)}
            aria-label={`Undo changes for ${entry.name}`}
            title="Undo change"
            tabIndex={dirty ? 0 : -1}
            aria-hidden={!dirty}
            className={cn(
              'inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-amber-600 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9 dark:text-amber-400',
              !dirty && 'invisible',
            )}
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {noteOpen && (
        <div className="mt-2.5 sm:ml-10">
          <label htmlFor={noteId} className="sr-only">Note for {entry.name}</label>
          <input
            id={noteId}
            autoFocus
            value={entry.notes ?? ''}
            maxLength={ATTENDANCE_NOTE_MAX}
            onChange={e => onNote(entry.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setNoteOpen(false); }}
            placeholder={entry.status === 'absent' ? 'Reason for absence (optional)' : 'Note (optional)'}
            className="input-field h-10 w-full"
          />
        </div>
      )}
    </li>
  );
});
