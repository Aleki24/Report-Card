"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, Globe2, Loader2, PenLine, Plus, RefreshCw, type LucideIcon } from 'lucide-react';
import { EXTERNAL_EXAM_TYPES, INTERNAL_EXAM_TYPES, type ExamTypeDefinition } from '@/lib/exam-types';
import { TONES, type Tone } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface ExamSetupMenuProps {
  /** Exam types the term already has; they are not offered again. */
  existingTypes: ReadonlySet<string>;
  seeding: boolean;
  onAddRound: (code: string) => void;
  onAddMissingSubjects: () => void;
  onCreateManually: () => void;
}

interface MenuItemProps {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description?: string;
  disabled?: boolean;
  onSelect: () => void;
}

function MenuItem({ icon: Icon, tone, title, description, disabled, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="group flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', tone.tile)} aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description && <span className="line-clamp-2 block text-xs leading-snug text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="py-1">
      <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

/**
 * The admin's "More" menu on the Exam step: add another round of exams to the
 * term, fill in exams for subjects added since, or create a single exam.
 */
export function ExamSetupMenu({ existingTypes, seeding, onAddRound, onAddMissingSubjects, onCreateManually }: ExamSetupMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Tap outside or Escape closes it (not :hover, which never fires on touch).
  // Arrow keys move between items, as a menu should.
  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    items()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = items();
      if (list.length === 0) return;
      e.preventDefault();
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[next].focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (action: () => void) => () => { setOpen(false); action(); };
  const missing = (types: ExamTypeDefinition[]) => types.filter(t => !existingTypes.has(t.code));
  const school = missing(INTERNAL_EXAM_TYPES);
  const external = missing(EXTERNAL_EXAM_TYPES);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={cn(
          'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open ? 'border-primary/50 bg-primary/10 text-primary' : 'border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
        )}
      >
        {seeding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        More
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Add exams"
          className={cn(
            'animate-pop-in z-[60] flex flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl',
            // Phones: a sheet above the bottom navigation, clear of both edges.
            'fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] max-h-[70dvh]',
            // Wider screens: a dropdown under the button.
            'sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:max-h-[min(70vh,34rem)] sm:w-[22rem]',
          )}
        >
          <div className="border-b border-border/70 px-4 py-3">
            <p className="text-sm font-semibold">Add exams to this term</p>
            <p className="text-xs text-muted-foreground">Each creates an exam for every subject in every class.</p>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto overscroll-contain p-1.5">
            {school.length > 0 && (
              <Section label="School exams">
                {school.map(t => (
                  <MenuItem key={t.code} icon={CalendarPlus} tone={TONES.blue} title={t.name} description={t.description} disabled={seeding} onSelect={pick(() => onAddRound(t.code))} />
                ))}
              </Section>
            )}
            {external.length > 0 && (
              <Section label="External & mock exams">
                {external.map(t => (
                  <MenuItem key={t.code} icon={Globe2} tone={TONES.violet} title={t.name} description={t.description} disabled={seeding} onSelect={pick(() => onAddRound(t.code))} />
                ))}
              </Section>
            )}
            <Section label="Tools">
              <MenuItem
                icon={RefreshCw}
                tone={TONES.emerald}
                title={seeding ? 'Working…' : 'Add exams for new subjects'}
                description="Fill in the term's exams for subjects added since they were set up."
                disabled={seeding || existingTypes.size === 0}
                onSelect={pick(onAddMissingSubjects)}
              />
              <MenuItem
                icon={PenLine}
                tone={TONES.amber}
                title="Create one exam"
                description="A single exam for one subject and class."
                onSelect={pick(onCreateManually)}
              />
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
