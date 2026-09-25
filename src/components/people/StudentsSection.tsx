"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, Pencil, PhoneOff, Trash2, Upload, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import Pagination from '@/components/dashboard/Pagination';
import { ConfirmDialog, DataTable, StatFilterTile, type DataTableColumn } from '@/components/ui';
import { UserProfileDialog } from '@/components/users/UserProfileDialog';
import { StatusBadge, UserAvatar } from '@/components/users/UserBadges';
import { humanize } from '@/components/users/userMeta';
import { useJsonList } from '@/hooks/useJsonList';
import { apiErrorMessage } from '@/lib/api-error-message';
import { isSeniorSchoolGrade } from '@/lib/curriculum-bands';
import { PATHWAY_ORDER, pathwayLabel } from '@/lib/pathway-definitions';
import { LoadError, NoMatches, ResultCount, SearchBox, Toolbar } from './PeopleUi';
import { StudentFormModal } from './StudentFormModal';
import { ImportStudentsModal } from './ImportStudentsModal';
import { BulkPathwayModal } from './BulkPathwayModal';
import { InviteCodesDialog } from './InviteCodesDialog';
import {
  admNoLabel, errorMessage, studentAsUser, studentName,
  type AcademicLevelOption, type CombinationOption, type CreatedCredential, type GradeOption, type GradeStreamOption, type StudentRow,
} from './peopleTypes';

const PER_PAGE = 20;

/** Status is ACTIVE / TRANSFERRED / GRADUATED / DEACTIVATED; "LEFT" is any but ACTIVE. */
const STATUS_FILTERS = [
  { id: 'ALL', label: 'Any status' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'LEFT', label: 'Not active' },
  { id: 'TRANSFERRED', label: 'Transferred' },
  { id: 'GRADUATED', label: 'Graduated' },
  { id: 'DEACTIVATED', label: 'Deactivated' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['id'];

const matchesStatus = (status: string, filter: StatusFilter) =>
  filter === 'ALL' || (filter === 'LEFT' ? status !== 'ACTIVE' : status === filter);

interface Filters {
  search: string;
  streamId: string;
  status: StatusFilter;
  /** A pathway code, 'UNASSIGNED', or '' for any. */
  pathway: string;
  combinationId: string;
  noGuardianPhone: boolean;
}

const NO_FILTERS: Filters = { search: '', streamId: '', status: 'ALL', pathway: '', combinationId: '', noGuardianPhone: false };

interface Lookups {
  gradeStreams: GradeStreamOption[];
  grades: GradeOption[];
  academicLevels: AcademicLevelOption[];
  combinations: CombinationOption[];
}

/** Classes, grades, curricula and combinations the forms and filters choose from. */
function useStudentLookups(): Lookups {
  const streams = useJsonList<GradeStreamOption>('/api/school/data?type=grade_streams', 'Could not load classes.');
  const combos = useJsonList<CombinationOption>('/api/school/data?type=subject_combinations', 'Could not load combinations.');
  const [structure, setStructure] = useState<{ grades: GradeOption[]; academic_levels: AcademicLevelOption[] }>({ grades: [], academic_levels: [] });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/academic-structure', { cache: 'no-store', signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then((j: { grades?: GradeOption[]; academic_levels?: AcademicLevelOption[] } | null) => {
        if (j) setStructure({ grades: j.grades ?? [], academic_levels: j.academic_levels ?? [] });
      })
      .catch(() => { /* the curriculum picker stays empty; saving still works */ });
    return () => controller.abort();
  }, []);

  return { gradeStreams: streams.rows, grades: structure.grades, academicLevels: structure.academic_levels, combinations: combos.rows };
}

export function StudentsSection({ initialSearch = '' }: { initialSearch?: string }) {
  const { role } = useAuth();
  // Bulk pathway assignment is admin-only on the server.
  const isAdmin = role === 'ADMIN';
  const students = useJsonList<StudentRow>('/api/school/data?type=students', 'Could not load students.');
  const { gradeStreams, grades, academicLevels, combinations } = useStudentLookups();

  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, search: initialSearch });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ student: StudentRow | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pathwaysOpen, setPathwaysOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [credentials, setCredentials] = useState<CreatedCredential[] | null>(null);

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  // Pathways and combinations only apply to CBC Senior School (Grades 10–12).
  const { seniorStreamIds, seniorStreams, curriculumOfClass } = useMemo(() => {
    const cbcLevelIds = new Set(academicLevels.filter(l => l.code === 'CBC').map(l => l.id));
    const seniorGradeIds = new Set(grades.filter(g => cbcLevelIds.has(g.academic_level_id) && isSeniorSchoolGrade(g)).map(g => g.id));
    const seniors = gradeStreams.filter(gs => seniorGradeIds.has(gs.grade_id));
    const levelByGrade = new Map(grades.map(g => [g.id, g.academic_level_id]));
    const gradeByStream = new Map(gradeStreams.map(gs => [gs.id, gs.grade_id]));
    return {
      seniorStreams: seniors,
      seniorStreamIds: new Set(seniors.map(gs => gs.id)) as ReadonlySet<string>,
      curriculumOfClass: (streamId: string) => levelByGrade.get(gradeByStream.get(streamId) ?? ''),
    };
  }, [academicLevels, grades, gradeStreams]);

  const all = students.rows;
  const hasPathways = combinations.length > 0;

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return all.filter(s =>
      (!q || `${studentName(s)} ${s.admission_number ?? ''} ${s.guardian_name ?? ''} ${s.guardian_phone ?? ''}`.toLowerCase().includes(q))
      && matchesStatus(s.status, filters.status)
      && (!filters.streamId || s.current_grade_stream_id === filters.streamId)
      && (!filters.pathway || (filters.pathway === 'UNASSIGNED' ? !s.pathway : s.pathway === filters.pathway))
      && (!filters.combinationId || s.subject_combination_id === filters.combinationId)
      && (!filters.noGuardianPhone || !s.guardian_phone?.trim()));
  }, [all, filters]);

  const stats = useMemo(() => ({
    total: all.length,
    active: all.filter(s => s.status === 'ACTIVE').length,
    left: all.filter(s => s.status !== 'ACTIVE').length,
    noPhone: all.filter(s => s.status === 'ACTIVE' && !s.guardian_phone?.trim()).length,
  }), [all]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  // A delete or a narrower filter can leave the page past the end.
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const refresh = useCallback(async () => {
    if (!(await students.reload())) toast.error("Saved, but the list couldn't refresh. Reload the page to see the change.");
  }, [students]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/delete-student?student_id=${encodeURIComponent(deleting.id)}`, { method: 'DELETE' });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not delete the student.'));
      toast.success(`${studentName(deleting)} deleted`);
      setDeleting(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const viewing = useMemo(() => all.find(s => s.id === viewingId) ?? null, [all, viewingId]);
  const viewingUser = useMemo(() => (viewing ? studentAsUser(viewing) : null), [viewing]);

  const columns: DataTableColumn<StudentRow>[] = [
    {
      key: 'student', header: 'Student',
      render: s => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar firstName={s.users?.first_name ?? null} lastName={s.users?.last_name ?? null} role="STUDENT" imageUrl={s.avatar_url} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{studentName(s)}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">{admNoLabel(s.admission_number)}</div>
          </div>
        </div>
      ),
    },
    { key: 'class', header: 'Class', className: 'whitespace-nowrap', render: s => s.grade_streams?.full_name ?? <span className="text-muted-foreground">No class</span> },
    ...(hasPathways ? [{
      // Only from lg up: next to the sidebar on a tablet it squeezed every column.
      key: 'pathway', header: 'Pathway', hideOnMobile: true, className: 'hidden lg:table-cell',
      render: (s: StudentRow) => s.pathway
        ? <span className="inline-flex rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300" title={s.subject_combinations?.name ?? undefined}>{pathwayLabel(s.pathway)}{s.subject_combinations ? ` · ${s.subject_combinations.code}` : ''}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    }] : []),
    {
      key: 'guardian', header: 'Guardian',
      render: s => (
        <div className="min-w-0">
          <div className="truncate">{s.guardian_name || '—'}</div>
          <div className={s.guardian_phone ? 'truncate text-[11px] text-muted-foreground' : 'text-[11px] font-medium text-amber-600 dark:text-amber-400'}>{s.guardian_phone || 'No phone'}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: s => <StatusBadge active={s.status === 'ACTIVE'} label={humanize(s.status)} /> },
  ];

  if (students.error) return <LoadError title="Couldn't load students" message={students.error} onRetry={students.retry} />;

  const tiles = [
    { key: 'all', icon: Users, hue: 'orange', label: 'Students', value: stats.total, hint: 'on the roll', selected: !isFiltered, onClick: () => { setFilters(NO_FILTERS); setPage(1); } },
    { key: 'active', icon: UserCheck, hue: 'emerald', label: 'Active', value: stats.active, hint: 'currently enrolled', selected: filters.status === 'ACTIVE' && !filters.noGuardianPhone, onClick: () => { setFilters({ ...NO_FILTERS, status: 'ACTIVE' }); setPage(1); } },
    { key: 'left', icon: UserX, hue: 'slate', label: 'Left', value: stats.left, hint: 'transferred, graduated or off', selected: filters.status === 'LEFT', onClick: () => { setFilters({ ...NO_FILTERS, status: 'LEFT' }); setPage(1); } },
    { key: 'phone', icon: PhoneOff, hue: 'amber', label: 'No phone', value: stats.noPhone, hint: "guardian can't get SMS", selected: filters.noGuardianPhone, onClick: () => { setFilters({ ...NO_FILTERS, status: 'ACTIVE', noGuardianPhone: true }); setPage(1); } },
  ] as const;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tiles.map(({ key, ...tile }) => <StatFilterTile key={key} loading={students.loading} {...tile} />)}
      </div>

      <Toolbar label="Student filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox className="flex-1" value={filters.search} onChange={v => setFilter('search', v)} placeholder="Search name, admission no. or guardian" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" aria-hidden="true" />Import
            </button>
            {isAdmin && hasPathways && (
              <button type="button" className="btn-secondary" onClick={() => setPathwaysOpen(true)}>
                <ClipboardList className="size-4" aria-hidden="true" />Pathways
              </button>
            )}
            <button type="button" className="btn-primary col-span-2 sm:col-span-1" onClick={() => setForm({ student: null })}>
              <UserPlus className="size-4" aria-hidden="true" />Add student
            </button>
          </div>
        </div>
        <div className={hasPathways ? 'mt-3 grid grid-cols-2 gap-2 md:grid-cols-4' : 'mt-3 grid grid-cols-2 gap-2'}>
          <select className="input-field" aria-label="Filter by class" value={filters.streamId} onChange={e => setFilter('streamId', e.target.value)}>
            <option value="">All classes</option>
            {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
          </select>
          <select className="input-field" aria-label="Filter by status" value={filters.status} onChange={e => setFilter('status', e.target.value as StatusFilter)}>
            {STATUS_FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          {hasPathways && (
            <>
              <select className="input-field" aria-label="Filter by pathway" value={filters.pathway} onChange={e => { setFilters(prev => ({ ...prev, pathway: e.target.value, combinationId: '' })); setPage(1); }}>
                <option value="">All pathways</option>
                {PATHWAY_ORDER.map(p => <option key={p} value={p}>{pathwayLabel(p)}</option>)}
                <option value="UNASSIGNED">Unassigned</option>
              </select>
              <select className="input-field" aria-label="Filter by subject combination" value={filters.combinationId} onChange={e => setFilter('combinationId', e.target.value)}>
                <option value="">All combinations</option>
                {combinations.filter(c => !filters.pathway || filters.pathway === 'UNASSIGNED' || c.pathway === filters.pathway).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </>
          )}
        </div>
      </Toolbar>

      {!students.loading && <ResultCount shown={filtered.length} total={all.length} noun={all.length === 1 ? 'student' : 'students'} refreshing={students.refreshing} />}

      <DataTable<StudentRow>
        columns={columns}
        rows={paginated}
        rowKey={s => s.id}
        loading={students.loading}
        onRowClick={s => setViewingId(s.id)}
        rowActions={s => (
          <span className="inline-flex gap-1 whitespace-nowrap">
            <button type="button" className="btn-icon text-muted-foreground hover:text-foreground" title="Edit" aria-label={`Edit ${studentName(s)}`} onClick={() => setForm({ student: s })}><Pencil className="size-4" /></button>
            <button type="button" className="btn-icon text-destructive/80 hover:text-destructive" title="Delete" aria-label={`Delete ${studentName(s)}`} onClick={() => setDeleting(s)}><Trash2 className="size-4" /></button>
          </span>
        )}
        emptyState={all.length === 0
          ? <NoMatches hue="orange" icon={<Users className="size-6" />} title="No students yet" description="Add students one at a time, or import a class list from Excel or CSV." />
          : <NoMatches hue="orange" icon={<Users className="size-6" />} title="No students match" description="Try another class, status or search." onClear={() => { setFilters(NO_FILTERS); setPage(1); }} />}
      />
      <div className="mt-2 overflow-hidden rounded-2xl">
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={PER_PAGE} onPageChange={setPage} />
      </div>

      <StudentFormModal
        open={form !== null}
        student={form?.student ?? null}
        onClose={() => setForm(null)}
        onSaved={created => { setForm(null); if (created) setCredentials([created]); void refresh(); }}
        gradeStreams={gradeStreams}
        academicLevels={academicLevels}
        combinations={combinations}
        seniorStreamIds={seniorStreamIds}
        curriculumOfClass={curriculumOfClass}
      />

      <ImportStudentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={created => { if (created.length > 0) setCredentials(prev => [...(prev ?? []), ...created]); void refresh(); }}
        gradeStreams={gradeStreams}
        academicLevels={academicLevels}
        defaultClassId={filters.streamId}
      />

      <BulkPathwayModal
        open={pathwaysOpen}
        onClose={() => setPathwaysOpen(false)}
        onSaved={() => void refresh()}
        students={all.filter(s => !!s.current_grade_stream_id && seniorStreamIds.has(s.current_grade_stream_id))}
        seniorStreams={seniorStreams}
        combinations={combinations}
        defaultStreamId={filters.streamId}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        onClose={() => { if (!deleteBusy) setDeleting(null); }}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        variant="danger"
        title="Delete student?"
        message={deleting ? `${studentName(deleting)} and all their marks, attendance, fees and report cards will be removed for good. To keep their records, edit them and set a status such as Transferred instead.` : ''}
        confirmText="Delete student"
      />

      <UserProfileDialog
        user={viewingUser}
        onClose={() => setViewingId(null)}
        onEdit={() => { setViewingId(null); if (viewing) setForm({ student: viewing }); }}
        editLabel="Edit student"
        onUpdated={() => void refresh()}
      />

      <InviteCodesDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
