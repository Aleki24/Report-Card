"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { HeartHandshake, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField, FormGrid, InputField, SelectField } from '@/components/ui/FormField';
import DataTable from '@/components/ui/DataTable';
import { ModulePage } from '@/components/ops/ModulePage';
import { LookupSelect } from '@/components/ops/SearchableSelect';
import { errorText, opsFetch } from '@/lib/ops/client';
import { humanize } from '@/lib/ops/format';

interface Link { id: string; relationship: string; is_primary: boolean; parent: { id: string; first_name: string; last_name: string; phone: string | null; is_active: boolean } | null }

const RELATIONSHIPS = ['MOTHER', 'FATHER', 'GUARDIAN', 'SPONSOR', 'OTHER'] as const;
const EMPTY = { first_name: '', last_name: '', phone: '', relationship: 'GUARDIAN' as (typeof RELATIONSHIPS)[number] };

/** Link parents to learners; new parents get an invite code by SMS. */
function ParentLinks() {
    const [studentId, setStudentId] = useState('');
    const [links, setLinks] = useState<Link[]>([]);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [code, setCode] = useState<string | null>(null);

    const load = useCallback(async (id: string) => {
        try { setLinks(await opsFetch<Link[]>(`/api/admin/parents?student_id=${id}`)); }
        catch (err) { toast.error(errorText(err)); }
    }, []);
    useEffect(() => { if (studentId) void load(studentId); }, [studentId, load]);

    const add = async () => {
        if (!form.first_name.trim() || !form.last_name.trim() || !form.phone.trim()) { toast.error('Fill in the parent’s name and phone.'); return; }
        setSaving(true);
        try {
            const r = await opsFetch<{ invite_code: string | null; reused: boolean }>('/api/admin/parents', { method: 'POST', json: { ...form, student_id: studentId } });
            setCode(r.invite_code);
            toast.success(r.reused ? 'Linked to the parent’s existing account.' : 'Parent account created; invite code sent by SMS.');
            setForm(EMPTY);
            await load(studentId);
        } catch (err) { toast.error(errorText(err)); }
        finally { setSaving(false); }
    };

    const unlink = async (id: string) => {
        try { await opsFetch(`/api/admin/parents/${id}`, { method: 'DELETE' }); toast.success('Unlinked.'); await load(studentId); }
        catch (err) { toast.error(errorText(err)); }
    };

    return (
        <div className="flex flex-col gap-5">
            <FormField label="Learner" htmlFor="pa-student" className="sm:max-w-md">
                <LookupSelect id="pa-student" lookup="students" value={studentId} onChange={v => { setStudentId(v); setCode(null); }} />
            </FormField>
            {studentId && (
                <>
                    <DataTable
                        rows={links}
                        rowKey={l => l.id}
                        emptyState="No parents linked to this learner yet."
                        columns={[
                            { key: 'name', header: 'Parent', render: l => <span className="font-medium">{l.parent ? `${l.parent.first_name} ${l.parent.last_name}` : '—'}</span> },
                            { key: 'rel', header: 'Relationship', render: l => humanize(l.relationship) },
                            { key: 'phone', header: 'Phone', hideOnMobile: true, render: l => l.parent?.phone ?? '—' },
                            { key: 'status', header: 'Account', render: l => (l.parent?.is_active ? 'Active' : 'Invite sent') },
                        ]}
                        rowActions={l => <Button variant="ghost" size="icon-sm" aria-label="Unlink parent" onClick={() => void unlink(l.id)}><Trash2 className="text-destructive" /></Button>}
                    />
                    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                        <h2 className="mb-3 text-sm font-semibold">Link a parent</h2>
                        <FormGrid>
                            <FormField label="First name" htmlFor="pa-first" required><InputField id="pa-first" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></FormField>
                            <FormField label="Last name" htmlFor="pa-last" required><InputField id="pa-last" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></FormField>
                            <FormField label="Phone" htmlFor="pa-phone" required hint="A parent already linked to another child is matched by phone."><InputField id="pa-phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></FormField>
                            <FormField label="Relationship" htmlFor="pa-rel"><SelectField id="pa-rel" value={form.relationship} placeholder={null} onChange={v => setForm(f => ({ ...f, relationship: v as (typeof RELATIONSHIPS)[number] }))} options={RELATIONSHIPS.map(r => ({ id: r, label: humanize(r) }))} /></FormField>
                        </FormGrid>
                        <Button className="mt-4" onClick={add} disabled={saving}><UserPlus />{saving ? 'Linking…' : 'Link parent'}</Button>
                        {code && <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm">Invite code: <code className="font-mono font-bold">{code}</code> — the parent activates at the sign-in page with this code.</p>}
                    </section>
                </>
            )}
        </div>
    );
}

export default function ParentAccountsPage() {
    return (
        <ModulePage
            module="parent_portal"
            title="Parent accounts"
            eyebrow="School"
            description="Give parents their own sign-in to follow each of their children."
            icon={HeartHandshake}
            hue="rose"
            tabs={[{ id: 'links', label: 'Parents', icon: HeartHandshake, hue: 'rose', render: () => <ParentLinks /> }]}
        />
    );
}
