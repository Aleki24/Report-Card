"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, BookOpen, Layers, Plus, RotateCcw, School, UserRoundX, Users } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { CardHeading, ConfirmDialog, Modal, StatTile } from '@/components/ui';
import type { Hue } from '@/components/ui/tones';
import { GradeCard } from '@/components/classes/GradeCard';
import { AddGradeModal, RenameClassModal } from '@/components/classes/ClassDialogs';
import { deleteClass } from '@/components/classes/classApi';
import { apiErrorMessage } from '@/lib/api-error-message';
import { CLASSES_OVERVIEW_URL, classDeleteBlocker, type ClassesOverview, type ClassSummary } from '@/lib/classes-overview';

/** One colour per curriculum, so CBC and 8-4-4 grades read apart at a glance. */
const CURRICULUM_HUES: readonly Hue[] = ['amber', 'violet', 'teal', 'sky'];

type Load = { state: 'loading' } | { state: 'ready'; data: ClassesOverview } | { state: 'error'; message: string };

export default function ClassesPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [addingGrade, setAddingGrade] = useState(false);
  const [renaming, setRenaming] = useState<ClassSummary | null>(null);
  const [deleting, setDeleting] = useState<ClassSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const loaded = useRef(false);

  const fetchOverview = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(CLASSES_OVERVIEW_URL, { cache: 'no-store' });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not load classes.'));
      setLoad({ state: 'ready', data: json as ClassesOverview });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load classes.';
      // A failed refresh keeps what is on screen and says so.
      if (loaded.current) toast.error(message);
      else setLoad({ state: 'error', message });
    }
  }, []);

  useEffect(() => { void fetchOverview(); }, [fetchOverview]);
  useEffect(() => { loaded.current = load.state === 'ready'; }, [load.state]);

  const data = load.state === 'ready' ? load.data : null;

  const view = useMemo(() => {
    if (!data) return null;
    const hueByCurriculum = new Map(data.curricula.map((c, i) => [c.id, CURRICULUM_HUES[i % CURRICULUM_HUES.length]]));
    const byGrade = new Map<string, ClassSummary[]>();
    for (const c of data.classes) byGrade.set(c.grade_id, [...(byGrade.get(c.grade_id) ?? []), c]);
    const taught = data.grades.filter(g => byGrade.has(g.id));
    const groups = data.curricula
      .map(c => ({ curriculum: c, hue: hueByCurriculum.get(c.id) ?? 'amber', grades: taught.filter(g => g.academic_level_id === c.id) }))
      .filter(g => g.grades.length > 0);
    return {
      byGrade,
      groups,
      gradeName: new Map(data.grades.map(g => [g.id, g.name_display])),
      untaught: data.grades.filter(g => !byGrade.has(g.id)),
      stats: {
        classes: data.classes.length,
        grades: taught.length,
        students: data.classes.reduce((n, c) => n + c.usage.activeStudents, 0),
        noTeacher: data.classes.filter(c => c.class_teachers.length === 0).length,
      },
    };
  }, [data]);

  const blocker = deleting ? classDeleteBlocker(deleting.usage) : null;

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteClass(deleting.id);
      toast.success(`${deleting.full_name} deleted`);
      setDeleting(null);
      await fetchOverview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the class.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader
        title="Classes"
        eyebrow="School"
        icon={School}
        hue="amber"
        description="Every grade you teach and its classes. Students, teachers, mark sheets and report cards all hang off a class."
        action={data && (
          <button type="button" className="btn-primary" onClick={() => setAddingGrade(true)}>
            <Plus className="size-4" aria-hidden />Add grade
          </button>
        )}
      />

      {load.state === 'error' && (
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState
            hue="rose"
            icon={<AlertTriangle className="size-6" />}
            title="Couldn't load classes"
            description={load.message}
            action={<button type="button" className="btn-primary" onClick={() => { setLoad({ state: 'loading' }); void fetchOverview(); }}><RotateCcw className="size-4" aria-hidden />Try again</button>}
          />
        </div>
      )}

      {load.state === 'loading' && (
        <div aria-busy="true">
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton-bone h-24 rounded-2xl" />)}</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-bone h-56 rounded-2xl" />)}</div>
        </div>
      )}

      {view && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatTile icon={School} hue="amber" label="Classes" value={view.stats.classes} hint="streams in all grades" />
            <StatTile icon={Layers} hue="violet" label="Grades" value={view.stats.grades} hint="with at least one class" />
            <StatTile icon={Users} hue="emerald" label="Students" value={view.stats.students.toLocaleString()} hint="enrolled in a class" />
            <StatTile icon={UserRoundX} label="No class teacher" value={view.stats.noTeacher} hint={view.stats.noTeacher ? 'assign one on the Users page' : 'every class has one'} tone={view.stats.noTeacher ? 'warn' : 'good'} />
          </div>

          {view.groups.length === 0 ? (
            <div className="mb-6 rounded-2xl border border-dashed border-border bg-card">
              <EmptyState
                hue="amber"
                icon={<School className="size-6" />}
                title="No classes yet"
                description="Add the grades your school teaches. Each needs at least one class before students and teachers can join it."
                action={<button type="button" className="btn-primary" onClick={() => setAddingGrade(true)}><Plus className="size-4" aria-hidden />Add your first grade</button>}
              />
            </div>
          ) : view.groups.map(({ curriculum, hue, grades }) => (
            <section key={curriculum.id} aria-labelledby={`curriculum-${curriculum.id}`} className="mb-8">
              <h2 id={`curriculum-${curriculum.id}`} className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {curriculum.name}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal">{grades.length} grade{grades.length === 1 ? '' : 's'}</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {grades.map(g => (
                  <GradeCard
                    key={g.id}
                    grade={g}
                    hue={hue}
                    classes={view.byGrade.get(g.id) ?? []}
                    onChanged={fetchOverview}
                    onRename={setRenaming}
                    onDelete={setDeleting}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Subjects are chosen from the national catalogue on their own page —
              a free-text form here used to invent codes that matched nothing. */}
          <Link
            href="/dashboard/subjects"
            className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <CardHeading icon={BookOpen} hue="emerald" className="mb-0" title="Subjects" description="Pick the subjects your school offers, set up senior school combinations and assign subject teachers." />
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
              Manage subjects
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>

          <AddGradeModal open={addingGrade} onClose={() => setAddingGrade(false)} onAdded={fetchOverview} grades={view.untaught} curricula={data?.curricula ?? []} />
          <RenameClassModal cls={renaming} gradeName={renaming ? view.gradeName.get(renaming.grade_id) ?? '' : ''} onClose={() => setRenaming(null)} onRenamed={fetchOverview} />
        </>
      )}

      {/* A class in use can't be deleted; say why instead of offering to. */}
      <Modal
        isOpen={deleting !== null && blocker !== null}
        onClose={() => setDeleting(null)}
        title={`${deleting?.full_name ?? 'This class'} is in use`}
        size="sm"
        footer={<>
          <Link href="/dashboard/people" className="btn-secondary">Open People</Link>
          <button type="button" className="btn-primary" onClick={() => setDeleting(null)}>OK</button>
        </>}
      >
        <p className="text-sm text-muted-foreground">{blocker}</p>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null && blocker === null}
        onClose={() => { if (!deleteBusy) setDeleting(null); }}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        variant="danger"
        title={`Delete ${deleting?.full_name ?? 'class'}?`}
        message="It has no students, exams or report cards. Any class teacher and subject teacher assignments to it are removed too."
        confirmText="Delete class"
      />
    </div>
  );
}
