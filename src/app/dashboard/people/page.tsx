"use client";

import PageHeader from '@/components/dashboard/PageHeader';
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseTabularFile, normalizeRowKeys, IMPORT_FILE_ACCEPT } from '@/lib/import/parse-tabular-file';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import Pagination from '@/components/dashboard/Pagination';
import { DataTable, type DataTableColumn, FormGrid, FormField, InputField, SelectField, Modal, StatTile } from '@/components/ui';
import { Users, GraduationCap, Heart, Search, Edit3, Trash2, Upload, ClipboardList, UserPlus, Mail, Phone, UserCheck, UserX, School, Briefcase, MessageSquare, X, AlertTriangle } from 'lucide-react';
import type { UserRole } from '@/types';
import type { UserRow } from '@/hooks/useUsersPage';
import { UserProfileDialog } from '@/components/users/UserProfileDialog';
import { RoleBadge, StatusBadge, UserAvatar } from '@/components/users/UserBadges';
import { humanize } from '@/components/users/userMeta';
import { cn } from '@/lib/utils';
import { isRoleIn } from '@/lib/roles';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong');
import { pathwayLabel } from '@/lib/pathway-definitions';
import { isSeniorSchoolGrade } from '@/lib/curriculum-bands';
import { CLASS_REQUIRED_MESSAGE } from '@/lib/classes';

type RoleTab = 'students' | 'teachers' | 'parents';

/** Search box used by every section's toolbar. */
function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="text"
        className="input-field input-icon-left input-icon-right"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function studentAsUser(s: StudentRow): UserRow {
  return {
    id: s.id,
    first_name: s.users?.first_name ?? '',
    last_name: s.users?.last_name ?? '',
    email: s.users?.email ?? null,
    username: '',
    phone: s.users?.phone ?? null,
    role: 'STUDENT',
    is_active: s.status === 'ACTIVE',
    created_at: '',
    admission_number: s.admission_number,
    avatar_url: s.avatar_url,
    class_name: s.grade_stream?.full_name ?? null,
  };
}

function staffAsUser(t: TeacherRow): UserRow {
  return {
    id: t.id,
    first_name: t.profile.first_name,
    last_name: t.profile.last_name,
    email: t.profile.email,
    username: '',
    phone: t.profile.phone || null,
    role: t.profile.role as UserRole,
    is_active: t.profile.is_active,
    created_at: '',
    job_title: t.profile.job_title ?? null,
    avatar_url: t.profile.avatar_url,
  };
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<ContentSkeleton />}>
      <PeoplePageInner />
    </Suspense>
  );
}

function PeoplePageInner() {
  const { role } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const initialSearch = searchParams.get('search') ?? '';
  const [tab, setTab] = useState<RoleTab>(
    initialTab === 'teachers' || initialTab === 'parents' ? initialTab : 'students'
  );

  const tabs = [
    { id: 'students' as const, label: 'Students', icon: <Users size={16} />, roles: ['ADMIN', 'CLASS_TEACHER'] as const },
    { id: 'teachers' as const, label: 'Staff', icon: <GraduationCap size={16} />, roles: ['ADMIN'] as const },
    { id: 'parents' as const, label: 'Parents', icon: <Heart size={16} />, roles: ['ADMIN'] as const },
  ].filter(t => isRoleIn(role, t.roles));
  // A tab this role cannot see (e.g. ?tab=parents for a class teacher) falls back to the first allowed one.
  const activeTab: RoleTab | undefined = tabs.some(t => t.id === tab) ? tab : tabs[0]?.id;

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <PageHeader
        title="People"
        eyebrow="School"
        icon={Users}
        hue="orange"
        description="Students, staff and parent contacts. Open anyone for their full profile."
      />

      {tabs.length > 1 && (
        <div role="tablist" aria-label="People" className="-mx-1 mb-6 flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/40 p-1 sm:w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none sm:gap-2 sm:px-4',
                activeTab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'students' && <StudentsSection initialSearch={initialSearch} />}
      {activeTab === 'teachers' && <TeachersSection />}
      {activeTab === 'parents' && <ParentsSection />}
    </div>
  );
}

/* ───── Students Section ───── */
interface StudentRow { id: string; admission_number: string | null; current_grade_stream_id: string | null; status: string; gender: string | null; date_of_birth: string | null; users: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null; guardian_name: string | null; guardian_phone: string | null; avatar_url: string | null; grade_stream: { full_name: string } | null; pathway: string | null; track: string | null; subject_combination_id: string | null; subject_combinations: { id: string; code: string; name: string } | null; }
interface CombinationOption { id: string; code: string; name: string; pathway: string; track?: string | null; is_active: boolean; }

/** Admission numbers are optional, so every display falls back to a dash. */
const admNoLabel = (value: string | null | undefined) => value?.trim() || '—';

/** One student row read from an import file, as sent to /api/admin/bulk-import-students. */
interface ImportRow {
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  date_of_birth: string;
  guardian_phone: string;
  guardian_name: string;
  guardian_email: string;
  class: string;
  stream: string;
  academic_level_id: string;
}

const GENDER_OPTIONS = [
  { id: 'MALE', label: 'Male' },
  { id: 'FEMALE', label: 'Female' },
];

const emptyStudentForm = { first_name: '', last_name: '', admission_number: '', gender: '', date_of_birth: '', guardian_name: '', guardian_phone: '', grade_stream_id: '', academic_level_id: '', pathway: '', track: '', subject_combination_id: '' };


function StudentsSection({ initialSearch = '' }: { initialSearch?: string }) {
  const { profile, role } = useAuth();
  // Bulk pathway assignment is admin-only on the server.
  const isAdmin = role === 'ADMIN';
  const [data, setData] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [gradeStreamFilter, setGradeStreamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [gradeStreams, setGradeStreams] = useState<{ id: string; full_name: string; grade_id?: string }[]>([]);
  const [grades, setGrades] = useState<{ id: string; code: string | null; name_display: string; academic_level_id: string; numeric_order: number }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...emptyStudentForm });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [academicLevels, setAcademicLevels] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [skippedData, setSkippedData] = useState<{ row: ImportRow; reason: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importClassId, setImportClassId] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{first_name: string; last_name: string; username: string; invite_code: string}[] | null>(null);
  const [combinations, setCombinations] = useState<CombinationOption[]>([]);
  const [pathwayFilter, setPathwayFilter] = useState('');
  const [combinationFilter, setCombinationFilter] = useState('');
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkStreamFilter, setBulkStreamFilter] = useState('');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkCombination, setBulkCombination] = useState('');
  const [bulkClear, setBulkClear] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const fetchStudents = useCallback(async (gs?: string) => {
    setLoading(true); setError(null);
    try {
      let url = '/api/school/data?type=students';
      const stream = gs ?? gradeStreamFilter;
      if (stream) url += `&grade_stream_id=${stream}`;
      const [sRes, gsRes, structureRes, cRes] = await Promise.all([
        fetch(url, { cache: 'no-store' }),
        fetch('/api/school/data?type=grade_streams', { cache: 'no-store' }),
        fetch('/api/admin/academic-structure', { cache: 'no-store' }),
        fetch('/api/school/data?type=subject_combinations', { cache: 'no-store' }),
      ]);
      if (!sRes.ok) { setError('Failed to load students'); return; }
      const [sJson, gsJson] = await Promise.all([sRes.json(), gsRes.json()]);
      setData(sJson.data || []); setGradeStreams(gsJson.data || []);
      if (structureRes.ok) { const j = await structureRes.json(); setAcademicLevels(j.academic_levels || []); setGrades(j.grades || []); }
      if (cRes.ok) { const cJson = await cRes.json(); setCombinations(cJson.data || []); }
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [gradeStreamFilter]);

  useEffect(() => { if (profile?.id) fetchStudents(); }, [profile?.id, fetchStudents]);

  const filtered = data.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''} ${s.admission_number ?? ''} ${s.guardian_phone||''}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'INACTIVE' ? s.status !== 'ACTIVE' : s.status === statusFilter);
    const matchStream = !gradeStreamFilter || s.current_grade_stream_id === gradeStreamFilter;
    const matchPathway = !pathwayFilter || (pathwayFilter === 'UNASSIGNED' ? !s.pathway : s.pathway === pathwayFilter);
    const matchCombination = !combinationFilter || s.subject_combination_id === combinationFilter;
    return matchSearch && matchStatus && matchStream && matchPathway && matchCombination;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  // Status is ACTIVE / TRANSFERRED / GRADUATED / DEACTIVATED; there is no
  // INACTIVE, so the old inactive count was always 0 and the filter empty.
  const stats = { total: data.length, active: data.filter(s => s.status === 'ACTIVE').length, inactive: data.filter(s => s.status !== 'ACTIVE').length, streams: gradeStreams.length };

  const handleSave = async () => {
    // ── Pre-save sanity checks so bad data doesn't silently break SMS later ──
    // Catch the common mistake of typing the phone number into Guardian Name.
    const nameTrimmed = (formData.guardian_name || '').trim();
    const nameLooksLikePhone = nameTrimmed.length > 0
      && /^[\d\s\-+()]+$/.test(nameTrimmed)
      && nameTrimmed.replace(/\D/g, '').length >= 7;
    if (nameLooksLikePhone) {
      toast.error('Guardian Name looks like a phone number — put the number in the Guardian Phone field instead.');
      return;
    }
    if (!formData.grade_stream_id) {
      toast.error(`${CLASS_REQUIRED_MESSAGE}`);
      return;
    }
    // Validate the phone itself so an unusable number is caught at entry, not at SMS time.
    if (formData.guardian_phone?.trim()) {
      const digits = formData.guardian_phone.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 12) {
        toast.error('Guardian Phone doesn\'t look right. Use a format like 0712345678.');
        return;
      }
    }
    setSaving(true);
    try {
      const method = editing ? 'PATCH' : 'POST';
      const url = editing ? '/api/admin/update-student' : '/api/admin/add-student';
      const body = editing ? { ...formData, student_id: editing } : formData;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success(editing ? 'Student updated' : 'Student added');
      setShowModal(false); setEditing(null); await fetchStudents();
      
      // If adding a new student, show their invite code!
      if (!editing && json.invite_code && json.username) {
        setCreatedCredentials([{
          first_name: formData.first_name,
          last_name: formData.last_name,
          username: json.username,
          invite_code: json.invite_code
        }]);
      }
    } catch (err: unknown) { toast.error(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    try {
      const res = await fetch(`/api/admin/delete-student?student_id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      toast.success('Deleted'); await fetchStudents();
    } catch (err: unknown) { toast.error(errorMessage(err)); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Accepts Excel as well as CSV — schools keep their rosters in .xlsx and
      // the "Save As CSV" step was being skipped or done wrong.
      const { rows } = await parseTabularFile(file);
      const parsed = rows.map((raw): ImportRow => {
        const row = normalizeRowKeys(raw);
        let first = row.firstname || row.first || '';
        let last = row.lastname || row.last || row.surname || '';
        if (!first && !last && (row.name || row.fullname || row.studentname)) {
          const parts = (row.name || row.fullname || row.studentname).trim().split(/\s+/);
          first = parts[0];
          last = parts.slice(1).join(' ');
        }
        return {
          first_name: first,
          last_name: last,
          admission_number: row.admissionnumber || row.admissionno || row.admno || row.adm || '',
          gender: row.gender || row.sex || '',
          date_of_birth: row.dateofbirth || row.dob || row.birthdate || '',
          guardian_phone: row.guardianphone || row.phone || row.parentphone || row.contact || '',
          guardian_name: row.guardianname || row.parentname || row.guardian || row.parent || '',
          guardian_email: row.guardianemail || row.parentemail || row.email || '',
          class: row.class || row.grade || row.form || row.level || '',
          stream: row.stream || row.section || '',
          academic_level_id: academicLevels.length === 1 ? academicLevels[0].id : '',
        };
      }).filter(r => r.first_name || r.last_name);

      if (parsed.length === 0) {
        toast.error('No student rows found. Check the file has a heading row with a name column.');
        return;
      }
      setImportData(parsed);
      setSkippedData([]); // Reset skipped data on new file upload
    } catch (err) {
      console.error('Import parse failed:', err);
      toast.error('Could not read that file. Use a CSV or Excel (.xlsx) file.');
    }
  };

  const handleImportSubmit = async () => {
    if (importData.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/admin/bulk-import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: importData, default_grade_stream_id: importClassId || undefined })
      });
      const r = await res.json();
      if (!res.ok) toast.error(`${r.error || 'Failed to import students'}`);
      else {
        if (r.skipped_rows?.length > 0) {
          toast.warning(`Imported ${r.imported}, skipped ${r.skipped_rows.length}`);
          setSkippedData(r.skipped_rows);
          setImportData((r.skipped_rows as { row: ImportRow }[]).map(s => s.row));
          if (r.created_credentials && r.created_credentials.length > 0) {
            setCreatedCredentials(r.created_credentials);
          }
        } else {
          toast.success(`${r.message || 'Students imported successfully'}`);
          setShowImportModal(false);
          setImportData([]);
          setSkippedData([]);
          setImportClassId('');
          if (r.created_credentials && r.created_credentials.length > 0) {
            setCreatedCredentials(r.created_credentials);
          }
        }
        await fetchStudents();
      }
    } catch {
      toast.error('Error importing students.');
    }
    setImporting(false);
  };

  // The profile dialog is shared with the Users page and speaks UserRow.
  const viewingUser = useMemo(() => {
    const s = data.find(row => row.id === viewingId);
    return s ? studentAsUser(s) : null;
  }, [data, viewingId]);

  // Pathways/combinations only apply to CBC Senior School (Grades 10-12)
  const cbcLevelIds = new Set(academicLevels.filter(l => l.code === 'CBC').map(l => l.id));
  const seniorGradeIds = new Set(grades.filter(g => cbcLevelIds.has(g.academic_level_id) && isSeniorSchoolGrade(g)).map(g => g.id));
  const seniorStreamIds = new Set(gradeStreams.filter(gs => gs.grade_id && seniorGradeIds.has(gs.grade_id)).map(gs => gs.id));
  const seniorStreams = gradeStreams.filter(gs => seniorStreamIds.has(gs.id));
  /** A class's curriculum (academic level), through its grade. */
  const curriculumOfClass = (streamId: string): string | undefined => {
    const gradeId = gradeStreams.find(gs => gs.id === streamId)?.grade_id;
    return grades.find(g => g.id === gradeId)?.academic_level_id;
  };
  const isSeniorStudent = (s: StudentRow) => !!s.current_grade_stream_id && seniorStreamIds.has(s.current_grade_stream_id);

  const openEdit = (s: StudentRow) => {
    setFormData({ first_name: s.users?.first_name || '', last_name: s.users?.last_name || '', admission_number: s.admission_number || '', gender: s.gender || '', date_of_birth: s.date_of_birth || '', guardian_name: s.guardian_name || '', guardian_phone: s.guardian_phone || '', grade_stream_id: s.current_grade_stream_id || '', academic_level_id: '', pathway: s.pathway || '', track: s.track || '', subject_combination_id: s.subject_combination_id || '' });
    setEditing(s.id); setShowModal(true);
  };

  const bulkFiltered = data.filter(s => {
    if (!isSeniorStudent(s)) return false; // Grades 10-12 (CBC) only
    const q = bulkSearch.toLowerCase();
    const matchSearch = !q || `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''} ${s.admission_number ?? ''}`.toLowerCase().includes(q);
    const matchStream = !bulkStreamFilter || s.current_grade_stream_id === bulkStreamFilter;
    return matchSearch && matchStream;
  });

  const handleBulkAssign = async () => {
    if (bulkSelected.size === 0) return;
    if (!bulkClear && !bulkCombination) { toast.error('Pick a subject combination or choose "Clear assignment".'); return; }
    setBulkSaving(true);
    try {
      const res = await fetch('/api/admin/student-pathways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_ids: Array.from(bulkSelected),
          subject_combination_id: bulkClear ? null : bulkCombination,
          pathway: null,
          track: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success(`${json.updated} student(s) ${bulkClear ? 'cleared' : 'assigned'}${json.warnings?.length ? ` (${json.warnings.length} sync warning(s))` : ''}`);
      setShowBulkAssign(false);
      setBulkSelected(new Set());
      setBulkCombination('');
      setBulkClear(false);
      await fetchStudents();
    } catch (err: unknown) { toast.error(errorMessage(err)); }
    finally { setBulkSaving(false); }
  };

  if (error) return <EmptyState icon={Users} title="Couldn't load students" body={error} />;

  return (
    <div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} hue="orange" label="Students" value={stats.total} hint="on the roll" />
        <StatTile icon={UserCheck} label="Active" value={stats.active} hint="currently enrolled" tone="good" />
        <StatTile icon={UserX} label="Left" value={stats.inactive} hint="transferred, graduated or off" tone={stats.inactive ? 'warn' : 'default'} />
        <StatTile icon={School} label="Classes" value={stats.streams} hint="streams" />
      </div>

      <section aria-label="Student filters" className="mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox className="flex-1" value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, admission no. or guardian phone" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary flex-1 sm:flex-none" onClick={() => setShowImportModal(true)}>
              <Upload className="size-4" aria-hidden="true" />Import
            </button>
            {isAdmin && combinations.length > 0 && (
              <button className="btn-secondary flex-1 sm:flex-none" onClick={() => { setBulkSelected(new Set()); setBulkStreamFilter(seniorStreamIds.has(gradeStreamFilter) ? gradeStreamFilter : ''); setBulkSearch(''); setBulkCombination(''); setBulkClear(false); setShowBulkAssign(true); }}>
                <ClipboardList className="size-4" aria-hidden="true" />Pathways
              </button>
            )}
            <button className="btn-primary flex-1 sm:flex-none" onClick={() => { setEditing(null); setFormData({ ...emptyStudentForm }); setShowModal(true); }}>
              <UserPlus className="size-4" aria-hidden="true" />Add student
            </button>
          </div>
        </div>
        <div className={cn('mt-3 grid grid-cols-2 gap-2', combinations.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-2')}>
          <select className="input-field" aria-label="Filter by class" value={gradeStreamFilter} onChange={e => { setGradeStreamFilter(e.target.value); setPage(1); }}>
            <option value="">All classes</option>
            {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
          </select>
          <select className="input-field" aria-label="Filter by status" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="ALL">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Not active</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="GRADUATED">Graduated</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
          {combinations.length > 0 && (
            <>
              <select className="input-field" aria-label="Filter by pathway" value={pathwayFilter} onChange={e => { setPathwayFilter(e.target.value); setCombinationFilter(''); setPage(1); }}>
                <option value="">All pathways</option>
                <option value="STEM">STEM</option>
                <option value="SOCIAL_SCIENCES">Social Sciences</option>
                <option value="ARTS_SPORTS">Arts &amp; Sports Science</option>
                <option value="UNASSIGNED">Unassigned</option>
              </select>
              <select className="input-field" aria-label="Filter by subject combination" value={combinationFilter} onChange={e => { setCombinationFilter(e.target.value); setPage(1); }}>
                <option value="">All combinations</option>
                {combinations.filter(c => !pathwayFilter || pathwayFilter === 'UNASSIGNED' || c.pathway === pathwayFilter).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </>
          )}
        </div>
      </section>

      {loading ? <ContentSkeleton message="Loading students..." /> : (
        <>
          <DataTable<StudentRow>
            columns={[
              {
                key: 'student', header: 'Student',
                render: s => (
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar firstName={s.users?.first_name ?? null} lastName={s.users?.last_name ?? null} role="STUDENT" imageUrl={s.avatar_url} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{s.users?.first_name ?? ''} {s.users?.last_name ?? ''}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.grade_stream?.full_name || 'No class'}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'admission_number', header: 'Admission No.', render: s => <span className="font-mono">{admNoLabel(s.admission_number)}</span> },
              { key: 'class', header: 'Class', render: s => s.grade_stream?.full_name || '—' },
              ...(combinations.length > 0 ? [{
                key: 'pathway', header: 'Pathway', hideOnMobile: true,
                render: (s: StudentRow) => s.pathway ? (
                  <span className="badge text-[11px]" title={`${s.track || ''}${s.subject_combinations ? ` · ${s.subject_combinations.name}` : ''}`}>
                    {s.pathway === 'STEM' ? 'STEM' : s.pathway === 'SOCIAL_SCIENCES' ? 'Soc. Sci' : 'Arts/Sports'}
                    {s.subject_combinations ? ` · ${s.subject_combinations.code}` : ''}
                  </span>
                ) : <span className="text-xs text-muted-foreground">—</span>,
              } as DataTableColumn<StudentRow>] : []),
              {
                key: 'guardian', header: 'Guardian',
                render: s => (
                  <div>
                    <div>{s.guardian_name || '—'}</div>
                    <div className={`text-[11px] ${s.guardian_phone ? 'text-muted-foreground' : 'text-amber-500'}`}>
                      {s.guardian_phone || 'No phone'}
                    </div>
                  </div>
                ),
              },
              {
                key: 'status', header: 'Status',
                render: s => <StatusBadge active={s.status === 'ACTIVE'} label={humanize(s.status)} />,
              },
            ]}
            rows={paginated}
            rowKey={s => s.id}
            onRowClick={s => setViewingId(s.id)}
            rowActions={s => (
              <span className="whitespace-nowrap">
                <button className="btn-icon text-muted-foreground hover:text-foreground" title="Edit" aria-label={`Edit ${s.users?.first_name ?? 'student'}`} onClick={() => openEdit(s)}><Edit3 size={14} /></button>
                <button className="btn-icon text-destructive/80 hover:text-destructive" title="Delete" aria-label={`Delete ${s.users?.first_name ?? 'student'}`} onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
              </span>
            )}
            emptyState={<EmptyState icon={Users} title="No students found" body="Try another class, status or search, or add a student." />}
          />
          <div className="mt-2 overflow-hidden rounded-2xl">
            <Pagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} pageSize={perPage} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit student' : 'Add student'}
        size="lg"
        footer={<>
          <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !formData.first_name || !formData.last_name}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add student'}</button>
        </>}
      >
            <FormGrid>
              <FormField label="First Name" span="half" required><InputField value={formData.first_name || ''} onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))} /></FormField>
              <FormField label="Last Name" span="half" required><InputField value={formData.last_name || ''} onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))} /></FormField>
              <FormField label="Admission No." span="half" hint="Leave empty if the school has not assigned one yet."><InputField placeholder="Optional" value={formData.admission_number || ''} onChange={e => setFormData(p => ({ ...p, admission_number: e.target.value }))} /></FormField>
              <FormField label="Gender" span="half"><SelectField placeholder="—" value={formData.gender || ''} onChange={v => setFormData(p => ({ ...p, gender: v }))} options={GENDER_OPTIONS} /></FormField>
              <FormField label="Date of Birth" span="half"><InputField type="date" value={formData.date_of_birth || ''} onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))} /></FormField>
              <FormField label="Guardian Name" span="half"><InputField value={formData.guardian_name || ''} onChange={e => setFormData(p => ({ ...p, guardian_name: e.target.value }))} /></FormField>
              <FormField label="Guardian Phone" span="half"><InputField type="tel" value={formData.guardian_phone || ''} onChange={e => setFormData(p => ({ ...p, guardian_phone: e.target.value }))} /></FormField>
              <FormField
                label="Class"
                span="half"
                required
                hint={gradeStreams.length === 0 ? 'No classes yet — add them on the Classes page first.' : undefined}
              >
                <SelectField
                  placeholder="Choose a class"
                  value={formData.grade_stream_id || ''}
                  // The class decides the curriculum, so pick it for the admin.
                  onChange={v => setFormData(p => ({ ...p, grade_stream_id: v, academic_level_id: curriculumOfClass(v) ?? p.academic_level_id }))}
                  options={gradeStreams.map(gs => ({ id: gs.id, label: gs.full_name }))}
                />
              </FormField>
              <FormField label="Curriculum" span="half"><SelectField placeholder="—" value={formData.academic_level_id || ''} onChange={v => setFormData(p => ({ ...p, academic_level_id: v }))} options={academicLevels.map(al => ({ id: al.id, label: al.name }))} /></FormField>
              {combinations.length > 0 && seniorStreamIds.has(formData.grade_stream_id) && (
                <>
                  <div className="col-span-2 border-t border-border pt-3 mt-1">
                    <p className="text-xs font-semibold text-muted-foreground">CBC Senior School Pathway (Grades 10–12)</p>
                  </div>
                  <FormField label="Subject Combination" span="half">
                    <select
                      className="input-field w-full"
                      value={formData.subject_combination_id || ''}
                      onChange={e => {
                        const combo = combinations.find(c => c.id === e.target.value);
                        setFormData(p => ({
                          ...p,
                          subject_combination_id: e.target.value,
                          pathway: combo ? combo.pathway : '',
                          track: combo ? (combo.track || '') : '',
                        }));
                      }}
                    >
                      <option value="">— None —</option>
                      {combinations.filter(c => c.is_active || c.id === formData.subject_combination_id).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Pathway / Track" span="half">
                    <input className="input-field w-full" readOnly value={formData.pathway ? `${pathwayLabel(formData.pathway)}${formData.track ? ` — ${formData.track}` : ''}` : '—'} title="Set automatically from the chosen combination" />
                  </FormField>
                </>
              )}
            </FormGrid>
      </Modal>

      {/* Bulk Pathway Assignment Modal */}
      <Modal
        isOpen={showBulkAssign}
        onClose={() => setShowBulkAssign(false)}
        title="Assign pathways & subject combinations"
        size="lg"
        footer={<>
          <button className="btn-secondary" onClick={() => setShowBulkAssign(false)} disabled={bulkSaving}>Cancel</button>
          <button className="btn-primary" onClick={handleBulkAssign} disabled={bulkSaving || bulkSelected.size === 0 || (!bulkClear && !bulkCombination)}>
            {bulkSaving ? 'Assigning…' : bulkClear ? `Clear ${bulkSelected.size} student(s)` : `Assign ${bulkSelected.size} student(s)`}
          </button>
        </>}
      >
            <p className="text-xs text-muted-foreground mb-4">Reassign existing CBC Senior School students (Grades 10–12) to a pathway/track/combination without re-entering their data. Their subject enrollments (3 electives + compulsory cores) sync automatically.</p>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select className="input-field" style={{ width: "auto", minWidth: "150px" }} value={bulkStreamFilter} onChange={e => setBulkStreamFilter(e.target.value)}>
                <option value="">All Senior Streams</option>
                {seniorStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
              </select>
              <div className="flex items-center input-field input-field-flush overflow-hidden px-0 flex-1">
                <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0"><Search size={14} /></span>
                <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm" placeholder="Search students..." value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} />
              </div>
              <button
                className="btn-secondary px-3 py-1.5 shrink-0"
                onClick={() => {
                  const allSelected = bulkFiltered.every(s => bulkSelected.has(s.id));
                  setBulkSelected(prev => {
                    const next = new Set(prev);
                    bulkFiltered.forEach(s => { if (allSelected) next.delete(s.id); else next.add(s.id); });
                    return next;
                  });
                }}
              >
                {bulkFiltered.length > 0 && bulkFiltered.every(s => bulkSelected.has(s.id)) ? 'Unselect all' : `Select all (${bulkFiltered.length})`}
              </button>
            </div>

            <div className="mb-4 max-h-72 min-h-[180px] overflow-y-auto rounded-xl border border-border">
              {bulkFiltered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {seniorStreamIds.size === 0
                    ? 'No CBC Grade 10–12 streams found. Create senior-school classes first — pathways only apply to Senior School students.'
                    : 'No senior-school students match.'}
                </p>
              ) : bulkFiltered.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(s.id)}
                    onChange={() => setBulkSelected(prev => { const next = new Set(prev); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; })}
                  />
                  <span className="text-xs font-medium flex-1">{s.users?.first_name} {s.users?.last_name} <span className="font-mono text-muted-foreground">({admNoLabel(s.admission_number)})</span></span>
                  <span className="text-[11px] text-muted-foreground">{s.grade_stream?.full_name || '—'}</span>
                  <span className={`text-[11px] font-semibold ${s.subject_combinations ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {s.subject_combinations?.code || 'Unassigned'}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-muted-foreground mb-2">Assign to combination</label>
                <select className="input-field w-full" value={bulkCombination} disabled={bulkClear} onChange={e => setBulkCombination(e.target.value)}>
                  <option value="">— Select combination —</option>
                  {combinations.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name} ({pathwayLabel(c.pathway)}{c.track ? ` / ${c.track}` : ''})</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap pb-2">
                <input type="checkbox" checked={bulkClear} onChange={e => setBulkClear(e.target.checked)} /> Clear assignment
              </label>
            </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { if (!importing) { setShowImportModal(false); setImportData([]); setSkippedData([]); setImportClassId(''); } }}
        title="Import students"
        size="lg"
        footer={<>
          <button className="btn-secondary" onClick={() => { setShowImportModal(false); setImportData([]); setSkippedData([]); setImportClassId(''); }} disabled={importing}>Cancel</button>
          <button className="btn-primary" onClick={handleImportSubmit} disabled={importing || importData.length === 0 || !importClassId}>{importing ? 'Importing…' : skippedData.length > 0 ? `Retry import (${importData.length})` : `Import ${importData.length} students`}</button>
        </>}
      >
            <p className="text-xs text-muted-foreground mb-4">Select a class, upload a <strong>CSV or Excel (.xlsx)</strong> file, and import. Columns: <strong>first_name, last_name, admission_number, gender</strong></p>

            {/* Class selection */}
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-2 font-medium">Assign to Class *</label>
              <select className="input-field w-full" value={importClassId} onChange={e => setImportClassId(e.target.value)}>
                <option value="">— Select Class —</option>
                {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-surface cursor-pointer text-xs font-medium hover:bg-muted transition-colors">
                <Upload size={14} /> Choose CSV or Excel file
                <input type="file" accept={IMPORT_FILE_ACCEPT} className="hidden" onChange={handleFileChange} />
              </label>
              <span className="text-xs text-muted-foreground">{importData.length > 0 ? `${importData.length} students found` : 'No file selected'}</span>
            </div>
            
            {skippedData.length > 0 && (
              <div className="p-3 mb-4 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs">
                <strong><AlertTriangle className="mr-1 inline size-3.5" aria-hidden />{skippedData.length} students skipped.</strong> Please correct the errors below and try importing again.
              </div>
            )}

            {importData.length > 0 && (
              <div className="mb-4 max-h-80 overflow-y-auto rounded-xl border border-border">
                <div className="w-full overflow-x-auto">
                  <table className="data-table w-full">
                    <thead><tr><th className="px-4 py-2 text-xs">First Name</th><th className="px-4 py-2 text-xs">Last Name</th><th className="px-4 py-2 text-xs">Admission No.</th><th className="px-4 py-2 text-xs">Gender</th></tr></thead>
                    <tbody>
                      {importData.map((row, i) => {
                        const skippedReason = skippedData[i]?.reason;
                        return (
                          <tr key={i} className={skippedReason ? 'bg-red-500/5' : ''}>
                            <td className="px-4 py-2 text-xs">
                              <input className="input-field py-1 px-2 w-full border border-border rounded" value={row.first_name || ''} onChange={e => {
                                  const newData = [...importData]; newData[i].first_name = e.target.value; setImportData(newData);
                              }} />
                              {skippedReason && <div className="text-[10px] text-red-400 mt-1 font-medium">{skippedReason}</div>}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <input className="input-field py-1 px-2 w-full border border-border rounded" value={row.last_name || ''} onChange={e => {
                                  const newData = [...importData]; newData[i].last_name = e.target.value; setImportData(newData);
                              }} />
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <input className="input-field py-1 px-2 w-full border border-border rounded" placeholder="Optional" value={row.admission_number || ''} onChange={e => {
                                  const newData = [...importData]; newData[i].admission_number = e.target.value; setImportData(newData);
                              }} />
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <select className="input-field py-1 px-2 w-full border border-border rounded" value={row.gender || ''} onChange={e => {
                                  const newData = [...importData]; newData[i].gender = e.target.value; setImportData(newData);
                              }}>
                                  <option value="">—</option><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!importClassId && importData.length > 0 && (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="size-3.5" aria-hidden />Select a class above before importing.</p>
            )}
      </Modal>

      <UserProfileDialog
        user={viewingUser}
        onClose={() => setViewingId(null)}
        onEdit={u => { const s = data.find(row => row.id === u.id); setViewingId(null); if (s) openEdit(s); }}
        editLabel="Edit student"
        onUpdated={() => fetchStudents()}
      />

      {/* Created Invite Codes Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" style={{ animation: 'fadeIn .2s ease' }}>
            <div className="p-6 border-b border-border shrink-0 bg-surface-raised">
              <h2 className="text-lg font-bold">Import Successful - Invite Codes</h2>
              <p className="text-xs text-muted-foreground mt-1">Please copy these invite codes. Users will need them to activate their accounts at <strong>/activate</strong> and set their own passwords. <strong className="text-amber-500">They will not be shown again!</strong></p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border">
                        <th className="px-4 py-3 font-semibold">Student Name</th>
                        <th className="px-4 py-3 font-semibold">Username</th>
                        <th className="px-4 py-3 font-semibold">Invite Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {createdCredentials.map((c, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-xs font-medium">{c.first_name} {c.last_name}</td>
                          <td className="px-4 py-3 text-xs font-mono">{c.username}</td>
                          <td className="px-4 py-3 text-xs font-mono tracking-widest uppercase">{c.invite_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border bg-surface-raised flex justify-end shrink-0">
              <button className="btn-primary" onClick={() => setCreatedCredentials(null)}>I have copied the invite codes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Teachers Section ───── */
interface TeacherRow { id: string; employee_id: string; profile: { first_name: string; last_name: string; email: string | null; phone: string; avatar_url: string | null; is_active: boolean; role: string; job_title?: string | null; }; subjects: string; classes: string; stats: { subjectCount: number; classCount: number; examCount: number; markCount: number; }; }

function TeachersSection() {
  const [data, setData] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [editData, setEditData] = useState({ first_name: '', last_name: '', phone: '', avatar_url: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/school/data?type=teachers', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setData(json.data || []);
    } catch (err) { console.error('Failed to fetch teachers:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const viewingUser = useMemo(() => {
    const t = data.find(row => row.id === viewingId);
    return t ? staffAsUser(t) : null;
  }, [data, viewingId]);

  const openEditTeacher = (t: TeacherRow) => {
    setEditingTeacher(t);
    setEditData({ first_name: t.profile.first_name, last_name: t.profile.last_name, phone: t.profile.phone, avatar_url: t.profile.avatar_url || '' });
  };

  const filtered = data.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${t.profile.first_name} ${t.profile.last_name} ${t.profile.email || ''} ${t.employee_id||''}`.toLowerCase().includes(q);
    const matchRole = roleFilter === 'ALL' || t.profile.role === roleFilter;
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? t.profile.is_active : !t.profile.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const stats = {
    total: data.length,
    teachers: data.filter(t => t.profile.role === 'CLASS_TEACHER' || t.profile.role === 'SUBJECT_TEACHER').length,
    office: data.filter(t => t.profile.role === 'ADMIN' || t.profile.role === 'STAFF').length,
    notActive: data.filter(t => !t.profile.is_active).length,
  };

  const handleSaveTeacher = async () => {
    if (!editingTeacher) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/update-teacher', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editData, teacher_id: editingTeacher.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('Teacher updated');
      setEditingTeacher(null);
      await fetchTeachers();
    } catch (err: unknown) { toast.error(errorMessage(err)); }
    finally { setSavingEdit(false); }
  };

  const handlePhotoFileSelect = async (f: File, onUrl: (url: string) => void) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/admin/upload-photo', { method: 'POST', body: fd });
      const j = await res.json();
      if (j.url) onUrl(j.url);
    } finally { setUploadingPhoto(false); }
  };

  if (loading) return <ContentSkeleton message="Loading teachers..." />;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Staff" value={stats.total} hint="with accounts" />
        <StatTile icon={GraduationCap} label="Teachers" value={stats.teachers} hint="class & subject" />
        <StatTile icon={Briefcase} label="Admin & office" value={stats.office} hint="admins and other staff" />
        <StatTile icon={UserX} label="Not active" value={stats.notActive} hint="not yet activated, or off" tone={stats.notActive ? 'warn' : 'default'} />
      </div>

      <section aria-label="Staff filters" className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
        <SearchBox className="col-span-2 md:col-span-1" value={search} onChange={setSearch} placeholder="Search name or email" />
        <select className="input-field" aria-label="Filter by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="ALL">All roles</option>
          <option value="CLASS_TEACHER">Class teacher</option>
          <option value="SUBJECT_TEACHER">Subject teacher</option>
          <option value="ADMIN">Admin</option>
          <option value="STAFF">Other staff</option>
        </select>
        {/* Staff accounts are only on or off; the student enrolment statuses never applied here. */}
        <select className="input-field" aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Not active</option>
        </select>
      </section>

      <DataTable<TeacherRow>
        columns={[
          {
            key: 'teacher', header: 'Teacher',
            render: t => (
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar firstName={t.profile.first_name} lastName={t.profile.last_name} role={t.profile.role as UserRole} imageUrl={t.profile.avatar_url} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{t.profile.first_name} {t.profile.last_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.profile.role === 'STAFF' ? (t.profile.job_title || 'Staff member') : (t.profile.email || '—')}</div>
                </div>
              </div>
            ),
          },
          { key: 'role', header: 'Role', render: t => <RoleBadge role={t.profile.role as UserRole} /> },
          { key: 'subjects', header: 'Subjects', render: t => <span className="text-sm text-muted-foreground">{t.subjects || '—'}</span>, hideOnMobile: true },
          { key: 'status', header: 'Status', render: t => <StatusBadge active={t.profile.is_active} /> },
        ]}
        rows={filtered}
        rowKey={t => t.id}
        onRowClick={t => setViewingId(t.id)}
        rowActions={t => (
          <button className="btn-icon text-muted-foreground hover:text-foreground" title="Edit" aria-label={`Edit ${t.profile.first_name}`} onClick={() => openEditTeacher(t)}><Edit3 size={14} /></button>
        )}
        emptyState={<EmptyState icon={GraduationCap} title="No staff found" body="Try another role, status or search." />}
      />

      <Modal
        isOpen={editingTeacher !== null}
        onClose={() => setEditingTeacher(null)}
        title="Edit staff member"
        footer={<>
          <button className="btn-secondary" onClick={() => setEditingTeacher(null)} disabled={savingEdit}>Cancel</button>
          <button className="btn-primary" onClick={handleSaveTeacher} disabled={savingEdit || uploadingPhoto}>{savingEdit ? 'Saving…' : 'Save changes'}</button>
        </>}
      >
        <FormGrid>
          <FormField label="First name" span="half"><InputField value={editData.first_name} onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))} /></FormField>
          <FormField label="Last name" span="half"><InputField value={editData.last_name} onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))} /></FormField>
          <FormField label="Phone" span="full"><InputField type="tel" value={editData.phone} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} /></FormField>
          <FormField label="Photo" span="full">
            <div className="flex items-center gap-3">
              <UserAvatar firstName={editData.first_name} lastName={editData.last_name} role={(editingTeacher?.profile.role ?? 'STAFF') as UserRole} imageUrl={editData.avatar_url || null} size="md" />
              <label className="btn-secondary h-9 cursor-pointer text-xs">
                <Upload className="size-3.5" aria-hidden="true" />{uploadingPhoto ? 'Uploading…' : editData.avatar_url ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileSelect(f, url => setEditData(p => ({ ...p, avatar_url: url }))); e.target.value = ''; }} />
              </label>
              {editData.avatar_url && (
                <button type="button" className="text-xs font-medium text-destructive hover:underline" onClick={() => setEditData(p => ({ ...p, avatar_url: '' }))}>Remove</button>
              )}
            </div>
          </FormField>
        </FormGrid>
      </Modal>

      <UserProfileDialog
        user={viewingUser}
        onClose={() => setViewingId(null)}
        onEdit={u => { const t = data.find(row => row.id === u.id); setViewingId(null); if (t) openEditTeacher(t); }}
        editLabel="Edit details"
        onUpdated={fetchTeachers}
      />
    </div>
  );
}

/* ───── Parents Section ───── */
interface ParentStudent { id: string; admission_number: string | null; first_name: string; last_name: string; status: string; grade_stream: { full_name: string } | null; }
interface Parent { id: string; name: string; phone: string; email: string; students: ParentStudent[]; }

function ParentsSection() {
  const [data, setData] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchParents = async () => {
      try {
        const res = await fetch('/api/school/data?type=parents');
        if (!res.ok) { setError('Failed to load parents'); return; }
        const json = await res.json();
        setData(json.data || []);
      } catch { setError('Failed to load'); }
      finally { setLoading(false); }
    };
    fetchParents();
  }, []);

  const filtered = data.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.email.toLowerCase().includes(q) || p.students.some(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q));
  });

  const stats = { total: data.length, linkedStudents: data.reduce((a, p) => a + p.students.length, 0), phoneContacts: data.filter(p => p.phone).length, emailContacts: data.filter(p => p.email).length };

  if (error) return <EmptyState icon={Heart} title="Couldn't load parents" body={error} />;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Heart} label="Parents" value={stats.total} hint="guardian contacts" />
        <StatTile icon={Users} label="Children" value={stats.linkedStudents} hint="linked to a parent" />
        <StatTile icon={Phone} label="With phone" value={stats.phoneContacts} hint="reachable by SMS" tone={stats.phoneContacts < stats.total ? 'warn' : 'good'} />
        <StatTile icon={Mail} label="With email" value={stats.emailContacts} hint="reachable by email" />
      </div>

      <section aria-label="Parent filters" className="mb-4 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
        <SearchBox value={search} onChange={setSearch} placeholder="Search parent, phone, email or child" />
      </section>

      {loading ? <ContentSkeleton message="Loading parents..." /> : filtered.length === 0 ? (
        <EmptyState icon={Heart} title="No parents found" body={search ? 'Nobody matches that search.' : 'Guardian details added to students appear here.'} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p => {
            const [first = '', ...rest] = p.name.split(/\s+/);
            return (
              <li key={p.id} className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <UserAvatar firstName={first} lastName={rest.join(' ')} role="PENDING" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{p.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{p.phone || 'No phone'}{p.email ? ` · ${p.email}` : ''}</p>
                  </div>
                </div>

                {p.students.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                    {p.students.map(s => (
                      <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.first_name} {s.last_name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{s.grade_stream?.full_name || 'No class'} · {admNoLabel(s.admission_number)}</p>
                        </div>
                        <StatusBadge active={s.status === 'ACTIVE'} label={humanize(s.status)} />
                      </li>
                    ))}
                  </ul>
                )}

                {(p.phone || p.email) && (
                  <div className="mt-4 flex gap-2">
                    {p.phone && (
                      <>
                        <a href={`tel:${p.phone}`} className="btn-secondary h-9 flex-1 text-xs"><Phone className="size-3.5" aria-hidden="true" />Call</a>
                        <a href={`sms:${p.phone}`} className="btn-secondary h-9 flex-1 text-xs"><MessageSquare className="size-3.5" aria-hidden="true" />SMS</a>
                      </>
                    )}
                    {p.email && <a href={`mailto:${p.email}`} className="btn-secondary h-9 flex-1 text-xs"><Mail className="size-3.5" aria-hidden="true" />Email</a>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
