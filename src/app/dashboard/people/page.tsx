"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Papa from 'papaparse';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton, InlineLoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { DataTable, type DataTableColumn } from '@/components/ui';
import { Users, GraduationCap, Heart, Search, Edit3, Trash2, X, Upload, FileText, Users as UsersIcon, Calendar, ClipboardList, BookOpen, UserPlus, Mail, Phone, MapPin, UserCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { pathwayLabel } from '@/lib/pathway-definitions';

type RoleTab = 'students' | 'teachers' | 'parents';

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
  ].filter(t => t.roles.includes(role as any));

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === tab)) setTab(tabs[0].id);
  }, [role]);

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-[1.25rem] xs:text-[1.5rem] sm:text-[1.75rem] font-bold tracking-tight font-display mb-1">People</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>Manage students, teachers, staff, and parent contacts</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-muted/50 border border-border rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'bg-[var(--color-surface)] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'students' && <StudentsSection initialSearch={initialSearch} />}
      {tab === 'teachers' && <TeachersSection />}
      {tab === 'parents' && <ParentsSection />}
    </div>
  );
}

/* ───── Students Section ───── */
interface StudentRow { id: string; admission_number: string; current_grade_stream_id: string | null; status: string; users: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null } | null; guardian_name: string | null; guardian_phone: string | null; avatar_url: string | null; grade_stream: { full_name: string } | null; pathway: string | null; track: string | null; subject_combination_id: string | null; subject_combinations: { id: string; code: string; name: string } | null; }
interface CombinationOption { id: string; code: string; name: string; pathway: string; track?: string | null; is_active: boolean; }

const emptyStudentForm = { first_name: '', last_name: '', admission_number: '', gender: '', date_of_birth: '', guardian_name: '', guardian_phone: '', grade_stream_id: '', academic_level_id: '', pathway: '', track: '', subject_combination_id: '' };
interface StudentDetail { profile: { first_name: string; last_name: string; admission_number: string; date_of_birth: string; gender: string; guardian_name: string; guardian_phone: string; avatar_url: string | null; status: string; grade_stream: { full_name: string } | null; pathway?: string | null; track?: string | null; subject_combination?: { code: string; name: string } | null; enrolled_subjects?: { id: string; name: string; code: string; role: 'CORE' | 'ELECTIVE' }[]; }; academicHistory: any[]; reportHistory: any[]; attendanceHistory: any[]; }

function StudentsSection({ initialSearch = '' }: { initialSearch?: string }) {
  const { profile } = useAuth();
  const [data, setData] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [gradeStreamFilter, setGradeStreamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [gradeStreams, setGradeStreams] = useState<{ id: string; full_name: string; grade_id?: string }[]>([]);
  const [grades, setGrades] = useState<{ id: string; academic_level_id: string; numeric_order: number }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...emptyStudentForm });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'profile' | 'academic' | 'reports' | 'attendance'>('profile');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [academicLevels, setAcademicLevels] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [skippedData, setSkippedData] = useState<{ row: any; reason: string }[]>([]);
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
    const matchSearch = !q || `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''} ${s.admission_number} ${s.guardian_phone||''}`.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchStream = !gradeStreamFilter || s.current_grade_stream_id === gradeStreamFilter;
    const matchPathway = !pathwayFilter || (pathwayFilter === 'UNASSIGNED' ? !s.pathway : s.pathway === pathwayFilter);
    const matchCombination = !combinationFilter || s.subject_combination_id === combinationFilter;
    return matchSearch && matchStatus && matchStream && matchPathway && matchCombination;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const stats = { total: data.length, active: data.filter(s => s.status !== 'INACTIVE').length, inactive: data.filter(s => s.status === 'INACTIVE').length, streams: gradeStreams.length };

  const handleSave = async () => {
    // ── Pre-save sanity checks so bad data doesn't silently break SMS later ──
    // Catch the common mistake of typing the phone number into Guardian Name.
    const nameTrimmed = (formData.guardian_name || '').trim();
    const nameLooksLikePhone = nameTrimmed.length > 0
      && /^[\d\s\-+()]+$/.test(nameTrimmed)
      && nameTrimmed.replace(/\D/g, '').length >= 7;
    if (nameLooksLikePhone) {
      showToast('❌ Guardian Name looks like a phone number — put the number in the Guardian Phone field instead.');
      return;
    }
    // Validate the phone itself so an unusable number is caught at entry, not at SMS time.
    if (formData.guardian_phone?.trim()) {
      const digits = formData.guardian_phone.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 12) {
        showToast('❌ Guardian Phone doesn\'t look right. Use a format like 0712345678.');
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
      showToast(editing ? '✅ Student updated' : '✅ Student added');
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
    } catch (err: any) { showToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this student?')) return;
    try {
      const res = await fetch(`/api/admin/delete-student?student_id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      showToast('✅ Deleted'); await fetchStudents();
    } catch (err: any) { showToast(`❌ ${err.message}`); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''),
      complete: (results) => {
        const parsed = results.data.map((row: any) => {
          let first = row.firstname || row.first || '';
          let last = row.lastname || row.last || row.surname || '';
          if (!first && !last && (row.name || row.fullname || row.studentname)) {
            const parts = (row.name || row.fullname || row.studentname).trim().split(' ');
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
        }).filter((r: any) => r.first_name || r.last_name);
        setImportData(parsed);
        setSkippedData([]); // Reset skipped data on new file upload
      },
      error: () => { showToast('❌ Failed to parse CSV file'); }
    });
    e.target.value = '';
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
      if (!res.ok) showToast(`❌ ${r.error || 'Failed to import students'}`);
      else {
        if (r.skipped_rows?.length > 0) {
          showToast(`⚠️ Imported ${r.imported}, skipped ${r.skipped_rows.length}`);
          setSkippedData(r.skipped_rows);
          setImportData(r.skipped_rows.map((s: any) => s.row));
          if (r.created_credentials && r.created_credentials.length > 0) {
            setCreatedCredentials(r.created_credentials);
          }
        } else {
          showToast(`✅ ${r.message || 'Students imported successfully'}`);
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
      showToast('❌ Error importing students.');
    }
    setImporting(false);
  };

  const handlePhoto = async (f: File, onUrl: (url: string) => void) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/admin/upload-photo', { method: 'POST', body: fd });
      const j = await res.json();
      if (j.url) onUrl(j.url);
    } finally { setUploadingPhoto(false); }
  };

  const viewStudentDetails = async (id: string) => {
    setViewLoading(true); setViewStudent(null); setViewTab('profile');
    try {
      const res = await fetch(`/api/school/students/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setViewStudent(await res.json());
    } catch { showToast('Failed to load details'); }
    finally { setViewLoading(false); }
  };

  // Pathways/combinations only apply to CBC Senior School (Grades 10-12):
  // streams whose grade is numeric_order 10-12 under the CBC level
  const cbcLevelIds = new Set(academicLevels.filter(l => l.code === 'CBC').map(l => l.id));
  const seniorGradeIds = new Set(grades.filter(g => g.numeric_order >= 10 && g.numeric_order <= 12 && cbcLevelIds.has(g.academic_level_id)).map(g => g.id));
  const seniorStreamIds = new Set(gradeStreams.filter(gs => gs.grade_id && seniorGradeIds.has(gs.grade_id)).map(gs => gs.id));
  const seniorStreams = gradeStreams.filter(gs => seniorStreamIds.has(gs.id));
  const isSeniorStudent = (s: StudentRow) => !!s.current_grade_stream_id && seniorStreamIds.has(s.current_grade_stream_id);

  const openEdit = (s: StudentRow) => {
    setFormData({ first_name: s.users?.first_name || '', last_name: s.users?.last_name || '', admission_number: s.admission_number, gender: '', date_of_birth: '', guardian_name: s.guardian_name || '', guardian_phone: s.guardian_phone || '', grade_stream_id: s.current_grade_stream_id || '', academic_level_id: '', pathway: s.pathway || '', track: s.track || '', subject_combination_id: s.subject_combination_id || '' });
    setEditing(s.id); setShowModal(true);
  };

  const bulkFiltered = data.filter(s => {
    if (!isSeniorStudent(s)) return false; // Grades 10-12 (CBC) only
    const q = bulkSearch.toLowerCase();
    const matchSearch = !q || `${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''} ${s.admission_number}`.toLowerCase().includes(q);
    const matchStream = !bulkStreamFilter || s.current_grade_stream_id === bulkStreamFilter;
    return matchSearch && matchStream;
  });

  const handleBulkAssign = async () => {
    if (bulkSelected.size === 0) return;
    if (!bulkClear && !bulkCombination) { showToast('❌ Pick a subject combination or choose "Clear assignment".'); return; }
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
      showToast(`✅ ${json.updated} student(s) ${bulkClear ? 'cleared' : 'assigned'}${json.warnings?.length ? ` (${json.warnings.length} sync warning(s))` : ''}`);
      setShowBulkAssign(false);
      setBulkSelected(new Set());
      setBulkCombination('');
      setBulkClear(false);
      await fetchStudents();
    } catch (err: any) { showToast(`❌ ${err.message}`); }
    finally { setBulkSaving(false); }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (error) return <div className="text-center py-16 text-muted-foreground"><Users size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm">{error}</p></div>;

  return (
    <div>
      {toast && <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg text-sm font-medium shadow-lg bg-muted border border-border text-foreground animate-in fade-in slide-in-from-bottom-5 duration-300">{toast}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card"><div className="stat-label">Total Students</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Active</div><div className="stat-value">{stats.active}</div></div>
        <div className="stat-card"><div className="stat-label">Inactive</div><div className="stat-value">{stats.inactive}</div></div>
        <div className="stat-card"><div className="stat-label">Streams</div><div className="stat-value">{stats.streams}</div></div>
      </div>

      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-4">
        <div className="flex items-center input-field overflow-hidden px-0 flex-1 min-w-[200px] max-w-[400px]">
          <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0"><Search size={16} /></span>
          <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm" placeholder="Search students..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-field text-xs" style={{ width: "auto", minWidth: "140px" }} value={gradeStreamFilter} onChange={e => { setGradeStreamFilter(e.target.value); setPage(1); }}>
          <option value="">All Streams</option>
          {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
        </select>
        <select className="input-field text-xs" style={{ width: "auto", minWidth: "120px" }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {combinations.length > 0 && (
          <>
            <select className="input-field text-xs" style={{ width: "auto", minWidth: "140px" }} value={pathwayFilter} onChange={e => { setPathwayFilter(e.target.value); setCombinationFilter(''); setPage(1); }}>
              <option value="">All Pathways</option>
              <option value="STEM">STEM</option>
              <option value="SOCIAL_SCIENCES">Social Sciences</option>
              <option value="ARTS_SPORTS">Arts &amp; Sports Science</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
            <select className="input-field text-xs" style={{ width: "auto", minWidth: "160px" }} value={combinationFilter} onChange={e => { setCombinationFilter(e.target.value); setPage(1); }}>
              <option value="">All Combinations</option>
              {combinations.filter(c => !pathwayFilter || pathwayFilter === 'UNASSIGNED' || c.pathway === pathwayFilter).map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </>
        )}
        <button className="btn-secondary text-xs px-4 py-2 shrink-0 flex items-center gap-2" onClick={() => setShowImportModal(true)}>
          <Upload size={14} /> Import CSV
        </button>
        {combinations.length > 0 && (
          <button className="btn-secondary text-xs px-4 py-2 shrink-0 flex items-center gap-2" onClick={() => { setBulkSelected(new Set()); setBulkStreamFilter(seniorStreamIds.has(gradeStreamFilter) ? gradeStreamFilter : ''); setBulkSearch(''); setBulkCombination(''); setBulkClear(false); setShowBulkAssign(true); }}>
            <ClipboardList size={14} /> Assign Pathways
          </button>
        )}
        <button className="btn-primary text-xs px-4 py-2 shrink-0 flex items-center gap-2" onClick={() => { setEditing(null); setFormData({ ...emptyStudentForm }); setShowModal(true); }}>
          <UserPlus size={14} /> Add Student
        </button>
      </div>

      {loading ? <ContentSkeleton message="Loading students..." /> : (
        <>
          <DataTable<StudentRow>
            columns={[
              {
                key: 'student', header: 'Student',
                render: s => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : getInitials(`${s.users?.first_name ?? ''} ${s.users?.last_name ?? ''}`)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{s.users?.first_name ?? ''} {s.users?.last_name ?? ''}</div>
                      <div className="text-xs text-muted-foreground">{s.users?.email || '—'}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'admission_number', header: 'Admission No.', render: s => <span className="font-mono">{s.admission_number}</span> },
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
                render: s => <span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span>,
              },
            ]}
            rows={paginated}
            rowKey={s => s.id}
            onRowClick={s => viewStudentDetails(s.id)}
            rowActions={s => (
              <span className="whitespace-nowrap">
                <button className="btn-icon text-muted-foreground hover:text-foreground" title="Edit" onClick={() => openEdit(s)}><Edit3 size={14} /></button>
                <button className="btn-icon text-destructive/80 hover:text-destructive" title="Delete" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></button>
              </span>
            )}
            emptyState={<><Users size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm">No students found.</p></>}
          />
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs px-3 py-1" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <button className="btn-secondary text-xs px-3 py-1" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display mb-4">{editing ? 'Edit Student' : 'Add Student'}</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">First Name *</label><input className="input-field w-full text-xs" value={formData.first_name || ''} onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Last Name *</label><input className="input-field w-full text-xs" value={formData.last_name || ''} onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Admission No.</label><input className="input-field w-full text-xs" value={formData.admission_number || ''} onChange={e => setFormData(p => ({ ...p, admission_number: e.target.value }))} placeholder="Auto-generated if left blank" /><p className="text-[10px] text-muted-foreground mt-1">Leave empty to auto-generate.</p></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Gender</label><select className="input-field w-full text-xs" value={formData.gender || ''} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}><option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Date of Birth</label><input type="date" className="input-field w-full text-xs" value={formData.date_of_birth || ''} onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Guardian Name</label><input className="input-field w-full text-xs" value={formData.guardian_name || ''} onChange={e => setFormData(p => ({ ...p, guardian_name: e.target.value }))} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Guardian Phone</label><input className="input-field w-full text-xs" value={formData.guardian_phone || ''} onChange={e => setFormData(p => ({ ...p, guardian_phone: e.target.value }))} /></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Class</label><select className="input-field w-full text-xs" value={formData.grade_stream_id || ''} onChange={e => setFormData(p => ({ ...p, grade_stream_id: e.target.value }))}><option value="">—</option>{gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}</select></div>
              <div className="col-span-2 sm:col-span-1"><label className="block text-xs text-muted-foreground mb-1">Curriculum</label><select className="input-field w-full text-xs" value={formData.academic_level_id || ''} onChange={e => setFormData(p => ({ ...p, academic_level_id: e.target.value }))}><option value="">—</option>{academicLevels.map(al => <option key={al.id} value={al.id}>{al.name}</option>)}</select></div>
              {combinations.length > 0 && seniorStreamIds.has(formData.grade_stream_id) && (
                <>
                  <div className="col-span-2 border-t border-border pt-3 mt-1">
                    <p className="text-xs font-semibold text-muted-foreground">CBC Senior School Pathway (Grades 10–12)</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs text-muted-foreground mb-1">Subject Combination</label>
                    <select
                      className="input-field w-full text-xs"
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
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs text-muted-foreground mb-1">Pathway / Track</label>
                    <input className="input-field w-full text-xs" readOnly value={formData.pathway ? `${pathwayLabel(formData.pathway)}${formData.track ? ` — ${formData.track}` : ''}` : '—'} title="Set automatically from the chosen combination" />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary text-xs" onClick={handleSave} disabled={saving || !formData.first_name || !formData.last_name}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Student'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Pathway Assignment Modal */}
      {showBulkAssign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowBulkAssign(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display mb-1">Assign Pathways &amp; Subject Combinations</h2>
            <p className="text-xs text-muted-foreground mb-4">Reassign existing CBC Senior School students (Grades 10–12) to a pathway/track/combination without re-entering their data. Their subject enrollments (3 electives + compulsory cores) sync automatically.</p>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select className="input-field text-xs" style={{ width: "auto", minWidth: "150px" }} value={bulkStreamFilter} onChange={e => setBulkStreamFilter(e.target.value)}>
                <option value="">All Senior Streams</option>
                {seniorStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
              </select>
              <div className="flex items-center input-field overflow-hidden px-0 flex-1">
                <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0"><Search size={14} /></span>
                <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-xs" placeholder="Search students..." value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} />
              </div>
              <button
                className="btn-secondary text-xs px-3 py-1.5 shrink-0"
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

            <div className="flex-1 overflow-y-auto mb-4 border border-border rounded-md min-h-[180px]">
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
                  <span className="text-xs font-medium flex-1">{s.users?.first_name} {s.users?.last_name} <span className="font-mono text-muted-foreground">({s.admission_number})</span></span>
                  <span className="text-[11px] text-muted-foreground">{s.grade_stream?.full_name || '—'}</span>
                  <span className={`text-[11px] font-semibold ${s.subject_combinations ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {s.subject_combinations?.code || 'Unassigned'}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end mb-4">
              <div className="flex-1 w-full">
                <label className="block text-xs text-muted-foreground mb-1">Assign to combination</label>
                <select className="input-field w-full text-xs" value={bulkCombination} disabled={bulkClear} onChange={e => setBulkCombination(e.target.value)}>
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

            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs" onClick={() => setShowBulkAssign(false)} disabled={bulkSaving}>Cancel</button>
              <button className="btn-primary text-xs" onClick={handleBulkAssign} disabled={bulkSaving || bulkSelected.size === 0 || (!bulkClear && !bulkCombination)}>
                {bulkSaving ? 'Assigning...' : bulkClear ? `Clear ${bulkSelected.size} student(s)` : `Assign ${bulkSelected.size} student(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowImportModal(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display mb-4">Bulk Import Students</h2>
            <p className="text-xs text-muted-foreground mb-4">Select a class, upload a CSV file, and import. CSV columns: <strong>first_name, last_name, admission_number, gender</strong></p>

            {/* Class selection */}
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Assign to Class *</label>
              <select className="input-field w-full text-xs" value={importClassId} onChange={e => setImportClassId(e.target.value)}>
                <option value="">— Select Class —</option>
                {gradeStreams.map(gs => <option key={gs.id} value={gs.id}>{gs.full_name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border bg-surface cursor-pointer text-xs font-medium hover:bg-muted transition-colors">
                <Upload size={14} /> Select CSV File
                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </label>
              <span className="text-xs text-muted-foreground">{importData.length > 0 ? `${importData.length} students found` : 'No file selected'}</span>
            </div>
            
            {skippedData.length > 0 && (
              <div className="p-3 mb-4 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs">
                <strong>⚠️ {skippedData.length} students skipped.</strong> Please correct the errors below and try importing again.
              </div>
            )}

            {importData.length > 0 && (
              <div className="flex-1 overflow-y-auto mb-4 border border-border rounded-md">
                <table className="data-table w-full">
                  <thead><tr><th className="px-4 py-2 text-xs">First Name</th><th className="px-4 py-2 text-xs">Last Name</th><th className="px-4 py-2 text-xs">Admission No.</th><th className="px-4 py-2 text-xs">Gender</th></tr></thead>
                  <tbody>
                    {importData.map((row, i) => {
                      const skippedReason = skippedData[i]?.reason;
                      return (
                        <tr key={i} className={skippedReason ? 'bg-red-500/5' : ''}>
                          <td className="px-4 py-2 text-xs">
                            <input className="input-field py-1 px-2 w-full text-xs border border-border rounded" value={row.first_name || ''} onChange={e => {
                                const newData = [...importData]; newData[i].first_name = e.target.value; setImportData(newData);
                            }} />
                            {skippedReason && <div className="text-[10px] text-red-400 mt-1 font-medium">{skippedReason}</div>}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <input className="input-field py-1 px-2 w-full text-xs border border-border rounded" value={row.last_name || ''} onChange={e => {
                                const newData = [...importData]; newData[i].last_name = e.target.value; setImportData(newData);
                            }} />
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <input className="input-field py-1 px-2 w-full text-xs border border-border rounded" placeholder="Auto-generate" value={row.admission_number || ''} onChange={e => {
                                const newData = [...importData]; newData[i].admission_number = e.target.value; setImportData(newData);
                            }} />
                          </td>
                          <td className="px-4 py-2 text-xs">
                            <select className="input-field py-1 px-2 w-full text-xs border border-border rounded" value={row.gender || ''} onChange={e => {
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
            )}
            {!importClassId && importData.length > 0 && (
              <p className="text-xs text-amber-500 mb-3">⚠️ Please select a class above before importing.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs" onClick={() => { setShowImportModal(false); setImportData([]); setSkippedData([]); setImportClassId(''); }} disabled={importing}>Cancel</button>
              <button className="btn-primary text-xs" onClick={handleImportSubmit} disabled={importing || importData.length === 0 || !importClassId}>{importing ? 'Importing...' : skippedData.length > 0 ? `Retry Import (${importData.length})` : `Import ${importData.length} Students`}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Panel */}
      {viewStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setViewStudent(null)}>
          <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-glow flex items-center justify-center text-sm font-bold text-accent">{getInitials(`${viewStudent.profile.first_name} ${viewStudent.profile.last_name}`)}</div>
                <div><h2 className="text-sm font-bold">{viewStudent.profile.first_name} {viewStudent.profile.last_name}</h2><p className="text-xs text-muted-foreground">{viewStudent.profile.admission_number} · {viewStudent.profile.grade_stream?.full_name || '—'}</p></div>
              </div>
              <button onClick={() => setViewStudent(null)} className="w-7 h-7 rounded-md border border-border bg-surface flex items-center justify-center cursor-pointer text-muted-foreground"><X size={14} /></button>
            </div>
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {(['profile', 'academic', 'reports', 'attendance'] as const).map(t => (
                <button key={t} onClick={() => setViewTab(t)} className={`px-4 py-3 text-xs font-semibold whitespace-nowrap bg-none border-none cursor-pointer ${viewTab === t ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}>{t === 'profile' ? 'Profile' : t === 'academic' ? 'Academic' : t === 'reports' ? 'Reports' : 'Attendance'}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {viewLoading ? <InlineLoadingSkeleton rows={4} /> : viewTab === 'profile' ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3"><div><span className="text-xs text-muted-foreground">Gender</span><p>{viewStudent.profile.gender || '—'}</p></div><div><span className="text-xs text-muted-foreground">DOB</span><p>{viewStudent.profile.date_of_birth ? new Date(viewStudent.profile.date_of_birth).toLocaleDateString() : '—'}</p></div></div>
                  <div><span className="text-xs text-muted-foreground">Guardian</span><p>{viewStudent.profile.guardian_name || '—'} {viewStudent.profile.guardian_phone ? `(${viewStudent.profile.guardian_phone})` : ''}</p></div>
                  <div><span className="text-xs text-muted-foreground">Status</span><p><span className={`badge ${viewStudent.profile.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{viewStudent.profile.status}</span></p></div>
                  {viewStudent.profile.pathway && (
                    <div>
                      <span className="text-xs text-muted-foreground">Pathway</span>
                      <p>{pathwayLabel(viewStudent.profile.pathway)}{viewStudent.profile.track ? ` — ${viewStudent.profile.track}` : ''}{viewStudent.profile.subject_combination ? ` (${viewStudent.profile.subject_combination.code} — ${viewStudent.profile.subject_combination.name})` : ''}</p>
                    </div>
                  )}
                  {(viewStudent.profile.enrolled_subjects?.length ?? 0) > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Subjects ({viewStudent.profile.enrolled_subjects!.length})</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {viewStudent.profile.enrolled_subjects!.map(sub => (
                          <span key={sub.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${sub.role === 'CORE' ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'}`}>
                            {sub.name}{sub.role === 'ELECTIVE' ? ' •' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : viewTab === 'academic' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3"><div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-lg font-bold text-accent">{viewStudent.academicHistory.length > 0 ? `${viewStudent.academicHistory[viewStudent.academicHistory.length - 1].average.toFixed(1)}%` : '—'}</div><div className="text-xs text-muted-foreground">Average</div></div><div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-lg font-bold text-blue-400">—</div><div className="text-xs text-muted-foreground">Best Grade</div></div><div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-lg font-bold text-amber-400">—</div><div className="text-xs text-muted-foreground">Position</div></div></div>
                  {viewStudent.academicHistory.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No academic history yet.</p>}
                </div>
              ) : viewTab === 'reports' ? (
                <div>{viewStudent.reportHistory.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No report history yet.</p> : <p className="text-xs text-muted-foreground">{viewStudent.reportHistory.length} report(s) generated.</p>}</div>
              ) : (
                <div><div className="p-3 rounded-lg bg-surface-raised text-center mb-3"><div className="text-lg font-bold text-emerald-400">{viewStudent.attendanceHistory.length > 0 ? `${Math.round(viewStudent.attendanceHistory.reduce((s: number, a: any) => s + (a.percentage ?? 0), 0) / viewStudent.attendanceHistory.length)}%` : '—'}</div><div className="text-xs text-muted-foreground">Attendance Rate</div></div>{viewStudent.attendanceHistory.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No attendance history yet.</p>}</div>
              )}
            </div>
          </div>
        </div>
      )}
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
            <div className="p-6 border-t border-border bg-surface-raised flex justify-end shrink-0">
              <button className="btn-primary text-xs" onClick={() => setCreatedCredentials(null)}>I have copied the invite codes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Teachers Section ───── */
interface TeacherRow { id: string; employee_id: string; profile: { first_name: string; last_name: string; email: string | null; phone: string; avatar_url: string | null; is_active: boolean; role: string; job_title?: string | null; }; subjects: string; classes: string; stats: { subjectCount: number; classCount: number; examCount: number; markCount: number; }; }
interface TeacherDetail { profile: { first_name: string; last_name: string; email: string | null; phone: string; avatar_url: string | null; is_active: boolean; role: string; job_title?: string | null; }; stats: { subjectCount: number; classCount: number; examCount: number; markCount: number; }; subjectAssignments: any[]; classAssignments: any[]; recentExams: any[]; }
type TeacherTab = 'overview' | 'subjects' | 'classes' | 'exams';

function TeachersSection() {
  const [data, setData] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [editData, setEditData] = useState({ first_name: '', last_name: '', phone: '', avatar_url: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewTeacher, setViewTeacher] = useState<TeacherDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTab, setViewTab] = useState<TeacherTab>('overview');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await fetch('/api/school/data?type=teachers');
        if (!res.ok) return;
        const json = await res.json();
        setData(json.data || []);
      } catch (err) { console.error('Failed to fetch teachers:', err); }
      finally { setLoading(false); }
    };
    fetchTeachers();
  }, []);

  const filtered = data.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${t.profile.first_name} ${t.profile.last_name} ${t.profile.email || ''} ${t.employee_id||''}`.toLowerCase().includes(q);
    const matchRole = roleFilter === 'ALL' || t.profile.role === roleFilter;
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? t.profile.is_active : !t.profile.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const roleBadge = (role: string, isActive: boolean, jobTitle?: string | null) => {
    if (!isActive) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400">Inactive</span>;
    const colors: Record<string, string> = { CLASS_TEACHER: 'bg-blue-500/15 text-blue-400', SUBJECT_TEACHER: 'bg-purple-500/15 text-purple-400', ADMIN: 'bg-red-500/15 text-red-400', STAFF: 'bg-sky-500/15 text-sky-400' };
    const labels: Record<string, string> = { CLASS_TEACHER: 'Class Teacher', SUBJECT_TEACHER: 'Subject Teacher', ADMIN: 'Admin', STAFF: 'Staff' };
    // Non-teaching staff carry a descriptive title (Bursar, Secretary, …) — show it in place of the generic "Staff".
    const label = role === 'STAFF' ? (jobTitle || 'Staff') : (labels[role] || role);
    return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colors[role] || 'bg-gray-500/15 text-gray-400'}`}>{label}</span>;
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSaveTeacher = async () => {
    if (!editingTeacher) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/update-teacher', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editData, teacher_id: editingTeacher.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      showToast('✅ Teacher updated');
      setEditingTeacher(null);
      const fetchRes = await fetch('/api/school/data?type=teachers');
      const fetchJson = await fetchRes.json();
      setData(fetchJson.data || []);
    } catch (err: any) { showToast(`❌ ${err.message}`); }
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

  const viewTeacherDetails = async (t: TeacherRow) => {
    setViewLoading(true); setViewTeacher(null); setViewTab('overview');
    try {
      const res = await fetch(`/api/school/teachers/${t.id}`);
      if (!res.ok) throw new Error();
      setViewTeacher(await res.json());
    } catch { showToast('Failed to load details'); }
    finally { setViewLoading(false); }
  };

  if (loading) return <ContentSkeleton message="Loading teachers..." />;

  return (
    <div>
      {toast && <div className="fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-lg text-sm font-medium shadow-lg bg-muted border border-border text-foreground animate-in fade-in slide-in-from-bottom-5 duration-300">{toast}</div>}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex items-center input-field overflow-hidden px-0 flex-1 min-w-[200px] max-w-[400px]">
          <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0"><Search size={16} /></span>
          <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field text-xs" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="ALL">All Roles</option>
          <option value="CLASS_TEACHER">Class Teacher</option>
          <option value="SUBJECT_TEACHER">Subject Teacher</option>
          <option value="ADMIN">Admin</option>
          <option value="STAFF">Other Staff</option>
        </select>
        <select className="input-field text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <DataTable<TeacherRow>
        columns={[
          {
            key: 'teacher', header: 'Teacher',
            render: t => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {t.profile.avatar_url ? <img src={t.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : getInitials(`${t.profile.first_name} ${t.profile.last_name}`)}
                </div>
                <span className="font-medium text-sm">{t.profile.first_name} {t.profile.last_name}</span>
              </div>
            ),
          },
          { key: 'email', header: 'Email', render: t => <span className="text-muted-foreground">{t.profile.email || '—'}</span> },
          { key: 'employee_id', header: 'Employee ID', render: t => <span className="font-mono">{t.employee_id || '—'}</span>, hideOnMobile: true },
          { key: 'role', header: 'Role', render: t => roleBadge(t.profile.role, t.profile.is_active, t.profile.job_title) },
          { key: 'subjects', header: 'Subjects', render: t => t.subjects || '—' },
        ]}
        rows={filtered}
        rowKey={t => t.id}
        onRowClick={t => viewTeacherDetails(t)}
        rowActions={t => (
          <button className="btn-icon text-muted-foreground hover:text-foreground" title="Edit" onClick={() => { setEditingTeacher(t); setEditData({ first_name: t.profile.first_name, last_name: t.profile.last_name, phone: t.profile.phone, avatar_url: t.profile.avatar_url || '' }); }}><Edit3 size={14} /></button>
        )}
        emptyState={<><GraduationCap size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm">No staff found.</p></>}
      />

      {editingTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setEditingTeacher(null)}>
          <div className="card w-full max-w-md" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-bold font-display mb-4">Edit Teacher</h2>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex gap-3">
                <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">First Name</label><input className="input-field w-full text-xs" value={editData.first_name} onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))} /></div>
                <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">Last Name</label><input className="input-field w-full text-xs" value={editData.last_name} onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))} /></div>
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">Phone</label><input className="input-field w-full text-xs" value={editData.phone} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} /></div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Photo</label>
                <div className="flex items-center gap-2">
                  {editData.avatar_url ? (
                    <div className="relative w-12 h-12 shrink-0"><img src={editData.avatar_url} className="w-12 h-12 rounded-full object-cover" /><button type="button" onClick={() => setEditData(p => ({ ...p, avatar_url: '' }))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white border-none text-xs flex items-center justify-center cursor-pointer">×</button></div>
                  ) : null}
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-surface cursor-pointer text-xs text-muted-foreground"><Upload size={12} />{uploadingPhoto ? 'Uploading...' : 'Choose File'}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} disabled={uploadingPhoto} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileSelect(f, url => setEditData(p => ({ ...p, avatar_url: url }))); e.target.value = ''; }} /></label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-xs" onClick={() => setEditingTeacher(null)} disabled={savingEdit}>Cancel</button>
              <button className="btn-primary text-xs disabled:opacity-50" onClick={handleSaveTeacher} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {viewTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setViewTeacher(null)}>
          <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ animation: 'fadeIn .2s ease' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-glow flex items-center justify-center text-xs font-bold text-accent">{getInitials(`${viewTeacher.profile.first_name} ${viewTeacher.profile.last_name}`)}</div>
                <div><h2 className="text-sm font-bold">{viewTeacher.profile.first_name} {viewTeacher.profile.last_name}</h2><p className="text-xs text-muted-foreground">{viewTeacher.profile.email} · {viewTeacher.profile.phone}</p></div>
              </div>
              <button onClick={() => setViewTeacher(null)} className="w-7 h-7 rounded-md border border-border bg-surface flex items-center justify-center cursor-pointer text-muted-foreground"><X size={14} /></button>
            </div>
            <div className="flex border-b border-border shrink-0 overflow-x-auto">
              {(['overview', 'subjects', 'classes', 'exams'] as TeacherTab[]).map(tab => (
                <button key={tab} onClick={() => setViewTab(tab)} className={`px-4 py-3 text-xs font-semibold whitespace-nowrap bg-none border-none cursor-pointer ${viewTab === tab ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}>{tab === 'overview' ? 'Overview' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {viewLoading ? <InlineLoadingSkeleton rows={4} /> : viewTab === 'overview' ? (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-sm font-bold text-accent">{viewTeacher.stats.subjectCount}</div><div className="text-xs text-muted-foreground">Subjects</div></div>
                    <div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-sm font-bold text-blue-400">{viewTeacher.stats.classCount}</div><div className="text-xs text-muted-foreground">Classes</div></div>
                    <div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-sm font-bold text-amber-400">{viewTeacher.stats.examCount}</div><div className="text-xs text-muted-foreground">Exams</div></div>
                    <div className="p-3 rounded-lg bg-surface-raised text-center"><div className="text-sm font-bold text-purple-400">{viewTeacher.stats.markCount}</div><div className="text-xs text-muted-foreground">Marks Entered</div></div>
                  </div>
                </div>
              ) : viewTab === 'subjects' ? (
                <div>{viewTeacher.subjectAssignments.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No subject assignments yet.</p> : <div className="space-y-2">{viewTeacher.subjectAssignments.map((sa: any, i: number) => <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-surface-raised"><div><div className="text-sm font-semibold">{sa.subject}</div><div className="text-xs text-muted-foreground">{sa.category} · {sa.subject_code}</div></div><div className="text-right text-xs text-muted-foreground"><div>{sa.grade}</div><div className="text-xs">{sa.stream || 'All streams'}</div></div></div>)}</div>}</div>
              ) : viewTab === 'classes' ? (
                <div>{viewTeacher.classAssignments.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No homeroom class assigned.</p> : <div className="space-y-2">{viewTeacher.classAssignments.map((ca: any) => <div key={ca.id} className="flex justify-between items-center p-3 rounded-lg bg-surface-raised"><span className="text-sm font-semibold">{ca.stream}</span><span className="text-xs text-muted-foreground">{ca.year}</span></div>)}</div>}</div>
              ) : (
                <div>{viewTeacher.recentExams.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No exams created yet.</p> : <div className="space-y-2">{viewTeacher.recentExams.map((ex: any) => <div key={ex.id} className="flex justify-between items-center p-3 rounded-lg bg-surface-raised"><div><div className="text-sm font-semibold">{ex.name}</div><div className="text-xs text-muted-foreground">{ex.subject} · {ex.grade}</div></div><div className="text-xs text-muted-foreground">{ex.date ? new Date(ex.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</div></div>)}</div>}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Parents Section ───── */
interface ParentStudent { id: string; admission_number: string; first_name: string; last_name: string; status: string; grade_stream: { full_name: string } | null; }
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

  if (error) return <div className="text-center py-16 text-muted-foreground"><Heart size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm">{error}</p></div>;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="stat-card"><div className="stat-label">Total Parents</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Linked Students</div><div className="stat-value">{stats.linkedStudents}</div></div>
        <div className="stat-card"><div className="stat-label">Phone Contacts</div><div className="stat-value">{stats.phoneContacts}</div></div>
        <div className="stat-card"><div className="stat-label">Email Contacts</div><div className="stat-value">{stats.emailContacts}</div></div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex items-center input-field overflow-hidden px-0 flex-1 min-w-[200px] max-w-[400px]">
          <span className="flex items-center justify-center pl-3 text-muted-foreground shrink-0"><Search size={16} /></span>
          <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-sm" placeholder="Search parents..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <ContentSkeleton message="Loading parents..." /> : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Heart size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm">No parents found.</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-semibold text-sm">{p.name}</h3><p className="text-xs text-muted-foreground">{p.phone} {p.email ? `· ${p.email}` : ''}</p></div>
              </div>
              {p.students.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Linked Children</p>
                  {p.students.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-surface-raised">
                      <div><span className="text-sm font-medium">{s.first_name} {s.last_name}</span><span className="text-xs text-muted-foreground ml-2">({s.admission_number})</span></div>
                      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{s.grade_stream?.full_name || '—'}</span><span className={`badge ${s.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
