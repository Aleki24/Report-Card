"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Award, BookOpen, CalendarRange, CreditCard, RotateCcw, School, Settings } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ConfirmDialog, Modal } from '@/components/ui';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import { AcademicStructureTab } from '@/components/settings/AcademicStructureTab';
import { GradingSystemsTab } from '@/components/settings/GradingSystemsTab';
import { AcademicCalendarTab, type AcademicYear, type Term } from '@/components/settings/AcademicCalendarTab';
import { PaymentsTab } from '@/components/settings/PaymentsTab';
import { SchoolForm, type SchoolProfile } from '@/components/settings/SchoolForm';
import { isSeniorRankGroup } from '@/lib/ranking';
import { PASS_MARK_MAX, PASS_MARK_MIN } from '@/lib/pass-mark';
import { apiErrorMessage } from '@/lib/api-error-message';

interface AcademicLevel { id: string; code: string; name: string }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string }
interface GradingSystem { id: string; name: string; description: string | null; academic_level_id: string; school_id?: string | null; system_kind?: 'SUBJECT' | 'OVERALL' }
interface GradingScale { id: string; grading_system_id: string; min_percentage: number; max_percentage: number; symbol: string; label: string; points: number | null; order_index: number }
interface SubjectOption { id: string; name: string; academic_level_id: string; grading_system_id: string | null }

interface SettingsData {
  academicLevels: AcademicLevel[];
  grades: Grade[];
  gradingSystems: GradingSystem[];
  gradingScales: GradingScale[];
  subjects: SubjectOption[];
  academicYears: AcademicYear[];
  terms: Term[];
  school: SchoolProfile;
}

type SettingsTab = 'profile' | 'calendar' | 'grading' | 'curriculum' | 'payments';
type StructureType = 'academic_year' | 'term' | 'grading_system';

const TABS: readonly PageTab<SettingsTab>[] = [
  { id: 'profile', label: 'School profile', shortLabel: 'Profile', icon: School, hue: 'amber' },
  { id: 'calendar', label: 'Academic calendar', shortLabel: 'Calendar', icon: CalendarRange, hue: 'blue' },
  { id: 'grading', label: 'Grading systems', shortLabel: 'Grading', icon: Award, hue: 'violet' },
  { id: 'curriculum', label: 'Curriculum', icon: BookOpen, hue: 'emerald' },
  { id: 'payments', label: 'Payments', icon: CreditCard, hue: 'teal' },
];

const STRUCTURE_URL = '/api/admin/academic-structure';
const DELETE_NOUN: Record<StructureType, string> = { academic_year: 'academic year', term: 'term', grading_system: 'grading system' };

type Load = { state: 'loading' } | { state: 'ready'; data: SettingsData } | { state: 'error'; message: string };

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function toSchool(raw: Record<string, unknown> | null | undefined): SchoolProfile {
  const r = raw ?? {};
  const str = (key: string) => (typeof r[key] === 'string' ? (r[key] as string) : '');
  return {
    id: str('id') || undefined,
    name: str('name'), address: str('address'), phone: str('phone'), email: str('email'), logo_url: str('logo_url'),
    motto: str('motto'), principal_name: str('principal_name'), principal_signature_url: str('principal_signature_url'),
    // PostgREST can send a numeric column as a string.
    pass_mark: r.pass_mark != null && Number.isFinite(Number(r.pass_mark)) ? Number(r.pass_mark) : null,
    min_combination_group_size: typeof r.min_combination_group_size === 'number' ? r.min_combination_group_size : 15,
    overall_grading_system_id: str('overall_grading_system_id') || null,
    cbc_ranking_enabled: r.cbc_ranking_enabled === true,
    senior_rank_group: isSeniorRankGroup(r.senior_rank_group) ? r.senior_rank_group : 'GRADE',
  };
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<ContentSkeleton message="Loading settings..." />}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const { profile } = useAuth();
  const [active, select] = useUrlTab(TABS);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [school, setSchool] = useState<SchoolProfile>(() => toSchool(null));
  const [savedSchool, setSavedSchool] = useState<SchoolProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<{ type: StructureType; id: string; label: string } | null>(null);
  const [blocked, setBlocked] = useState<{ label: string; message: string } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [structureRes, schoolRes, yearsRes, termsRes] = await Promise.all([
        fetch(STRUCTURE_URL, { cache: 'no-store' }),
        fetch('/api/school/data?type=school_profile', { cache: 'no-store' }),
        fetch('/api/school/data?type=academic_years', { cache: 'no-store' }),
        fetch('/api/school/data?type=terms', { cache: 'no-store' }),
      ]);
      const responses = [structureRes, schoolRes, yearsRes, termsRes];
      const bodies = await Promise.all(responses.map(readJson));
      const failedAt = responses.findIndex(r => !r.ok);
      if (failedAt >= 0) throw new Error(apiErrorMessage(bodies[failedAt], 'Could not load settings.'));
      const [structure, schoolJson, years, terms] = bodies;
      const s = (structure ?? {}) as Record<string, unknown[]>;
      const loadedSchool = toSchool((schoolJson as { data?: Record<string, unknown> } | null)?.data);
      setLoad({
        state: 'ready',
        data: {
          academicLevels: (s.academic_levels ?? []) as AcademicLevel[],
          grades: (s.grades ?? []) as Grade[],
          gradingSystems: (s.grading_systems ?? []) as GradingSystem[],
          gradingScales: (s.grading_scales ?? []) as GradingScale[],
          subjects: (s.subjects ?? []) as SubjectOption[],
          academicYears: ((years as { data?: AcademicYear[] } | null)?.data) ?? [],
          terms: ((terms as { data?: Term[] } | null)?.data) ?? [],
          school: loadedSchool,
        },
      });
      setSchool(prev => (savedSchool === null || prev === savedSchool ? loadedSchool : prev));
      setSavedSchool(loadedSchool);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load settings.';
      setLoad(prev => (prev.state === 'ready' ? prev : { state: 'error', message }));
      if (load.state === 'ready') toast.error(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (profile?.id) void fetchAll(); }, [profile?.id, fetchAll]);

  const data = load.state === 'ready' ? load.data : null;
  const passMarkValid = school.pass_mark == null || (school.pass_mark >= PASS_MARK_MIN && school.pass_mark <= PASS_MARK_MAX);
  const profileDirty = useMemo(() => savedSchool !== null && JSON.stringify(school) !== JSON.stringify(savedSchool), [school, savedSchool]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school.name.trim() || !passMarkValid) return;
    setSavingProfile(true);
    try {
      const res = await fetch('/api/admin/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: school.id, name: school.name, address: school.address, phone: school.phone, email: school.email,
          logo_url: school.logo_url || null, min_combination_group_size: school.min_combination_group_size ?? null,
          motto: school.motto, principal_name: school.principal_name,
          principal_signature_url: school.principal_signature_url || null, pass_mark: school.pass_mark,
          cbc_ranking_enabled: school.cbc_ranking_enabled ?? false, senior_rank_group: school.senior_rank_group ?? 'GRADE',
        }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save the profile.'));
      toast.success('School profile saved');
      // The name and logo also show in the sidebar, which reads them once.
      const shellChanged = savedSchool && (savedSchool.name !== school.name.trim() || savedSchool.logo_url !== school.logo_url);
      if (shellChanged) window.location.reload();
      else await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  /** Sends a change; resolves to the saved row, or null after reporting the failure. */
  const send = async (method: 'POST' | 'PATCH', body: Record<string, unknown>, success: string): Promise<{ id: string } | null> => {
    setBusy(true);
    try {
      const res = await fetch(STRUCTURE_URL, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save.'));
      toast.success(success);
      await fetchAll();
      return ((json as { data?: { id: string } } | null)?.data) ?? { id: '' };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const create = (type: string, payload: Record<string, unknown>) =>
    send('POST', { type, ...payload }, `${DELETE_NOUN[type as StructureType] ?? type.replace('_', ' ')} added`.replace(/^./, c => c.toUpperCase()));
  const patch = (type: string, id: string, payload: Record<string, unknown>) => send('PATCH', { type, id, ...payload }, 'Saved');

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`${STRUCTURE_URL}?type=${deleting.type}&id=${encodeURIComponent(deleting.id)}`, { method: 'DELETE' });
      const json = await readJson(res);
      if (res.status === 409) {
        // In use: say why instead of deleting.
        setBlocked({ label: deleting.label, message: apiErrorMessage(json, 'It is still in use.') });
        setDeleting(null);
        return;
      }
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not delete.'));
      toast.success(`${deleting.label} deleted`);
      setDeleting(null);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete.');
    } finally {
      setBusy(false);
    }
  };

  const setCurrentTerm = (term: Term) =>
    void patch('term', term.id, { is_current: true }).then(ok => { if (ok) toast.success(`${term.name} is now the current term`); });

  /** Reopening dates save as they are picked; the list updates at once so the picker doesn't snap back. */
  const updateTermDates = async (termId: string, field: 'midterm_reopening_date' | 'reopening_date', value: string) => {
    if (!data) return;
    const previous = data.terms;
    setLoad({ state: 'ready', data: { ...data, terms: data.terms.map(t => (t.id === termId ? { ...t, [field]: value || null } : t)) } });
    try {
      const res = await fetch(STRUCTURE_URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'term', id: termId, [field]: value || null }) });
      if (!res.ok) throw new Error(apiErrorMessage(await readJson(res), 'Could not save the reopening date.'));
    } catch (err) {
      setLoad(prev => (prev.state === 'ready' ? { state: 'ready', data: { ...prev.data, terms: previous } } : prev));
      toast.error(err instanceof Error ? err.message : 'Could not save the reopening date.');
    }
  };

  const setOverallGrading = async (gradingSystemId: string) => {
    if (!school.id) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: school.id, name: savedSchool?.name ?? school.name, address: savedSchool?.address, phone: savedSchool?.phone, email: savedSchool?.email, logo_url: savedSchool?.logo_url || null, overall_grading_system_id: gradingSystemId || null }),
      });
      if (!res.ok) throw new Error(apiErrorMessage(await readJson(res), 'Could not change the overall grading.'));
      toast.success('Overall grading system updated');
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the overall grading.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader title="School settings" eyebrow="Administration" icon={Settings} hue="slate" description="Your school's profile, academic calendar, grading and payments." />

      <PageTabs tabs={TABS} active={active} onSelect={select} label="Settings" idPrefix="settings" />

      <div role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${active}`}>
        {active === 'payments' ? <PaymentsTab /> : load.state === 'loading' ? (
          <ContentSkeleton message="Loading settings..." />
        ) : load.state === 'error' ? (
          <div className="rounded-2xl border border-dashed border-border bg-card">
            <EmptyState
              hue="rose"
              icon={<AlertTriangle className="size-6" />}
              title="Couldn't load settings"
              description={load.message}
              action={<button type="button" className="btn-primary" onClick={() => { setLoad({ state: 'loading' }); void fetchAll(); }}><RotateCcw className="size-4" aria-hidden />Try again</button>}
            />
          </div>
        ) : data && (
          <>
            {active === 'profile' && (
              <form onSubmit={saveProfile} className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
                <SchoolForm school={school} setSchool={setSchool} />
                <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] mt-6 flex items-center justify-end gap-3 border-t border-border/60 bg-card pt-4 min-[768px]:bottom-0">
                  {profileDirty && (
                    <button type="button" className="btn-secondary" onClick={() => savedSchool && setSchool(savedSchool)} disabled={savingProfile}>Discard</button>
                  )}
                  <button type="submit" className="btn-primary" disabled={savingProfile || !profileDirty || !school.name.trim() || !passMarkValid}>
                    {savingProfile ? 'Saving…' : profileDirty ? 'Save changes' : 'Saved'}
                  </button>
                </div>
              </form>
            )}
            {active === 'calendar' && (
              <AcademicCalendarTab
                academicYears={data.academicYears}
                terms={data.terms}
                saving={busy}
                onCreate={create}
                onDelete={(type, id, label) => setDeleting({ type, id, label })}
                onSetCurrentTerm={setCurrentTerm}
                onUpdateTermDates={(id, field, value) => void updateTermDates(id, field, value)}
              />
            )}
            {active === 'grading' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <GradingSystemsTab
                  academicLevels={data.academicLevels}
                  gradingSystems={data.gradingSystems}
                  gradingScales={data.gradingScales}
                  subjects={data.subjects}
                  overallGradingSystemId={data.school.overall_grading_system_id}
                  schoolId={data.school.id}
                  saving={busy}
                  onCreate={create}
                  onDelete={async (type, id) => {
                    const name = data.gradingSystems.find(g => g.id === id)?.name ?? 'This grading system';
                    setDeleting({ type: type as StructureType, id, label: name });
                  }}
                  onPatch={patch}
                  onSetOverall={setOverallGrading}
                />
              </div>
            )}
            {active === 'curriculum' && <AcademicStructureTab academicLevels={data.academicLevels} grades={data.grades} />}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => { if (!busy) setDeleting(null); }}
        onConfirm={() => void confirmDelete()}
        loading={busy}
        variant="danger"
        title={`Delete ${deleting?.label ?? ''}?`}
        message={deleting ? `This removes the ${DELETE_NOUN[deleting.type]}. Anything that still uses it (exams, report cards, fee records) stops the delete, and you'll be told what.` : ''}
        confirmText="Delete"
      />

      <Modal isOpen={blocked !== null} onClose={() => setBlocked(null)} title={`${blocked?.label ?? 'This'} is in use`} size="sm" footer={<button type="button" className="btn-primary" onClick={() => setBlocked(null)}>OK</button>}>
        <p className="text-sm text-muted-foreground">{blocked?.message}</p>
      </Modal>
    </div>
  );
}
