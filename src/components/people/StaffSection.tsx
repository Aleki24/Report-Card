"use client";

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Briefcase, GraduationCap, Pencil, Upload, Users, UserX } from 'lucide-react';
import { DataTable, FormField, FormGrid, InputField, Modal, StatFilterTile, type DataTableColumn } from '@/components/ui';
import { UserProfileDialog } from '@/components/users/UserProfileDialog';
import { RoleBadge, StatusBadge, UserAvatar } from '@/components/users/UserBadges';
import { useJsonList } from '@/hooks/useJsonList';
import { apiErrorMessage } from '@/lib/api-error-message';
import type { UserRole } from '@/types';
import { LoadError, NoMatches, ResultCount, SearchBox, Toolbar } from './PeopleUi';
import { errorMessage, staffAsUser, type StaffRow } from './peopleTypes';

const TEACHING: readonly UserRole[] = ['CLASS_TEACHER', 'SUBJECT_TEACHER'];
const OFFICE: readonly UserRole[] = ['ADMIN', 'STAFF'];

const ROLE_FILTERS = [
  { id: 'ALL', label: 'All roles' },
  { id: 'CLASS_TEACHER', label: 'Class teacher' },
  { id: 'SUBJECT_TEACHER', label: 'Subject teacher' },
  { id: 'ADMIN', label: 'Admin' },
  { id: 'STAFF', label: 'Other staff' },
] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number]['id'] | 'TEACHING' | 'OFFICE';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const staffName = (t: StaffRow) => `${t.profile.first_name} ${t.profile.last_name}`.trim() || 'Staff member';

function matchesRole(role: UserRole, filter: RoleFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'TEACHING') return TEACHING.includes(role);
  if (filter === 'OFFICE') return OFFICE.includes(role);
  return role === filter;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

interface EditForm { first_name: string; last_name: string; phone: string; avatar_url: string }

function EditStaffModal({ member, onClose, onSaved }: { member: StaffRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<EditForm>({ first_name: member.profile.first_name, last_name: member.profile.last_name, phone: member.profile.phone, avatar_url: member.profile.avatar_url ?? '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (key: keyof EditForm, value: string) => setForm(p => ({ ...p, [key]: value }));

  const uploadPhoto = async (file: File) => {
    if (file.size > MAX_PHOTO_BYTES) { toast.error('That photo is over 2 MB. Choose a smaller one.'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload-photo', { method: 'POST', body: fd });
      const json: unknown = await res.json().catch(() => null);
      const url = (json as { url?: string } | null)?.url;
      if (!res.ok || !url) throw new Error(apiErrorMessage(json, 'Could not upload the photo.'));
      set('avatar_url', url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/update-teacher', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, teacher_id: member.id }) });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Could not save the changes.'));
      toast.success(`${form.first_name} updated`);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      title="Edit staff member"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || uploading || !form.first_name.trim() || !form.last_name.trim()}>{saving ? 'Saving…' : 'Save changes'}</button>
      </>}
    >
      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-muted/40 p-3">
        <UserAvatar firstName={form.first_name} lastName={form.last_name} role={member.profile.role} imageUrl={form.avatar_url || null} size="md" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-secondary h-9 cursor-pointer text-xs">
            <Upload className="size-3.5" aria-hidden="true" />{uploading ? 'Uploading…' : form.avatar_url ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadPhoto(f); }} />
          </label>
          {form.avatar_url && <button type="button" className="text-xs font-medium text-destructive hover:underline" onClick={() => set('avatar_url', '')}>Remove</button>}
          <span className="w-full text-[11px] text-muted-foreground">JPEG, PNG or WebP, up to 2 MB.</span>
        </div>
      </div>
      <FormGrid>
        <FormField label="First name" span="half" required><InputField value={form.first_name} onChange={e => set('first_name', e.target.value)} /></FormField>
        <FormField label="Last name" span="half" required><InputField value={form.last_name} onChange={e => set('last_name', e.target.value)} /></FormField>
        <FormField label="Phone" span="full"><InputField type="tel" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></FormField>
      </FormGrid>
    </Modal>
  );
}

export function StaffSection() {
  const staff = useJsonList<StaffRow>('/api/school/data?type=teachers', 'Could not load staff.');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const all = staff.rows;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(t =>
      (!q || `${staffName(t)} ${t.profile.email ?? ''} ${t.profile.phone} ${t.subjects} ${t.classes}`.toLowerCase().includes(q))
      && matchesRole(t.profile.role, roleFilter)
      && (statusFilter === 'ALL' || (statusFilter === 'ACTIVE') === t.profile.is_active));
  }, [all, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: all.length,
    teachers: all.filter(t => TEACHING.includes(t.profile.role)).length,
    office: all.filter(t => OFFICE.includes(t.profile.role)).length,
    notActive: all.filter(t => !t.profile.is_active).length,
  }), [all]);

  const viewing = useMemo(() => all.find(t => t.id === viewingId) ?? null, [all, viewingId]);
  const viewingUser = useMemo(() => (viewing ? staffAsUser(viewing) : null), [viewing]);

  const refresh = async () => {
    if (!(await staff.reload())) toast.error("Saved, but the list couldn't refresh. Reload the page to see the change.");
  };

  const pick = (role: RoleFilter, status: StatusFilter) => () => { setRoleFilter(role); setStatusFilter(status); setSearch(''); };
  const isFiltered = search !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  if (staff.error) return <LoadError title="Couldn't load staff" message={staff.error} onRetry={staff.retry} />;

  const columns: DataTableColumn<StaffRow>[] = [
    {
      key: 'member', header: 'Name',
      render: t => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar firstName={t.profile.first_name} lastName={t.profile.last_name} role={t.profile.role} imageUrl={t.profile.avatar_url} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{staffName(t)}</div>
            <div className="truncate text-xs text-muted-foreground">{t.profile.role === 'STAFF' ? (t.profile.job_title || 'Staff member') : (t.profile.email || t.profile.phone || '—')}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: t => <RoleBadge role={t.profile.role} /> },
    { key: 'subjects', header: 'Subjects', hideOnMobile: true, render: t => <span className="line-clamp-2 text-sm text-muted-foreground">{t.subjects || '—'}</span> },
    { key: 'classes', header: 'Classes', hideOnMobile: true, className: 'hidden lg:table-cell', render: t => <span className="line-clamp-2 text-sm text-muted-foreground">{t.classes || '—'}</span> },
    { key: 'status', header: 'Status', render: t => <StatusBadge active={t.profile.is_active} /> },
  ];

  const tiles = [
    { key: 'all', icon: Users, hue: 'blue', label: 'Staff', value: stats.total, hint: 'with accounts', selected: !isFiltered, onClick: pick('ALL', 'ALL') },
    { key: 'teachers', icon: GraduationCap, hue: 'violet', label: 'Teachers', value: stats.teachers, hint: 'class & subject', selected: roleFilter === 'TEACHING' && statusFilter === 'ALL', onClick: pick('TEACHING', 'ALL') },
    { key: 'office', icon: Briefcase, hue: 'teal', label: 'Admin & office', value: stats.office, hint: 'admins and other staff', selected: roleFilter === 'OFFICE' && statusFilter === 'ALL', onClick: pick('OFFICE', 'ALL') },
    { key: 'inactive', icon: UserX, hue: 'amber', label: 'Not active', value: stats.notActive, hint: 'not yet activated, or off', selected: statusFilter === 'INACTIVE' && roleFilter === 'ALL', onClick: pick('ALL', 'INACTIVE') },
  ] as const;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tiles.map(({ key, ...tile }) => <StatFilterTile key={key} loading={staff.loading} {...tile} />)}
      </div>

      <Toolbar label="Staff filters" className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
        <SearchBox className="col-span-2 md:col-span-1" value={search} onChange={setSearch} placeholder="Search name, email, subject or class" />
        <select className="input-field" aria-label="Filter by role" value={roleFilter === 'TEACHING' || roleFilter === 'OFFICE' ? 'ALL' : roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)}>
          {ROLE_FILTERS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        {/* Staff accounts are only on or off; the student enrolment statuses never applied here. */}
        <select className="input-field" aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="ALL">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Not active</option>
        </select>
      </Toolbar>

      {!staff.loading && <ResultCount shown={filtered.length} total={all.length} noun="staff" refreshing={staff.refreshing} />}

      <DataTable<StaffRow>
        columns={columns}
        rows={filtered}
        rowKey={t => t.id}
        loading={staff.loading}
        onRowClick={t => setViewingId(t.id)}
        rowActions={t => (
          <button type="button" className="btn-icon text-muted-foreground hover:text-foreground" title="Edit" aria-label={`Edit ${staffName(t)}`} onClick={() => setEditing(t)}><Pencil className="size-4" /></button>
        )}
        emptyState={<NoMatches hue="blue" icon={<GraduationCap className="size-6" />} title="No staff match" description="Try another role, status or search." onClear={isFiltered ? pick('ALL', 'ALL') : undefined} />}
      />

      {editing && <EditStaffModal key={editing.id} member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}

      <UserProfileDialog
        user={viewingUser}
        onClose={() => setViewingId(null)}
        onEdit={() => { setViewingId(null); if (viewing) setEditing(viewing); }}
        editLabel="Edit details"
        onUpdated={() => void refresh()}
      />
    </div>
  );
}
