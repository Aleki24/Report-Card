"use client";

import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable';
import { FormField, FormGrid, InputField, SelectField } from '@/components/ui/FormField';
import { LookupSelect, SearchableSelect } from '@/components/ops/SearchableSelect';
import { useAuth } from '@/components/AuthProvider';
import { useOpsList } from '@/hooks/useOpsList';
import { useLookup } from '@/hooks/useLookup';
import { DUTIES, DUTY_KEYS, SCOPE_LABELS, dutyDefinition, type DutyKey, type ScopeType } from '@/lib/platform/permissions';
import { date, personName } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';
import type { LookupOption } from '@/lib/ops/lookups';

interface DutyRow {
    id: string;
    user_id: string;
    duty: DutyKey;
    scope_type: ScopeType | null;
    scope_id: string | null;
    starts_on: string | null;
    ends_on: string | null;
    user: PersonName & { role: string } | null;
}

interface Named { id: string; name?: string; registration?: string }

/** Options for a duty's scope: its dorms, vehicles, routes or classes. */
function useScopeOptions(scope: ScopeType | undefined): { options: LookupOption[]; loading: boolean } {
    const streams = useLookup('streams');
    const dorms = useOpsList<Named>('dorms', {}, { enabled: scope === 'DORM' });
    const routes = useOpsList<Named>('routes', {}, { enabled: scope === 'ROUTE' });
    return useMemo(() => {
        switch (scope) {
            case 'STREAM': return streams;
            case 'DORM': return { options: dorms.rows.map(d => ({ id: d.id, label: d.name ?? '' })), loading: dorms.loading };
            case 'ROUTE': return { options: routes.rows.map(r => ({ id: r.id, label: r.name ?? '' })), loading: routes.loading };
            default: return { options: [], loading: false };
        }
    }, [scope, streams, dorms.rows, dorms.loading, routes.rows, routes.loading]);
}

const EMPTY = { user_id: '', duty: '' as DutyKey | '', scope_id: '', starts_on: '', ends_on: '' };

/**
 * Who holds which job: DOS, bursar, matron, nurse, driver… Each duty grants
 * the permissions listed beside it, on top of the person's login role.
 */
export function DutiesTab() {
    const { hasModule } = useAuth();
    const { rows, loading, create, remove } = useOpsList<DutyRow>('duties');
    const [form, setForm] = useState(EMPTY);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<DutyRow | null>(null);

    const offered = DUTY_KEYS.filter(k => {
        const m = dutyDefinition(k).module;
        return !m || hasModule(m);
    });
    const duty = form.duty ? dutyDefinition(form.duty) : null;
    const scope = duty?.scope;
    const scopeOptions = useScopeOptions(scope);

    const columns: DataTableColumn<DutyRow>[] = [
        { key: 'person', header: 'Person', render: r => <span className="font-medium">{personName(r.user)}</span> },
        { key: 'duty', header: 'Duty', render: r => DUTIES[r.duty]?.label ?? r.duty },
        { key: 'scope', header: 'Limited to', hideOnMobile: true, render: r => (r.scope_type ? SCOPE_LABELS[r.scope_type] ?? r.scope_type : 'Whole school') },
        { key: 'dates', header: 'Dates', hideOnMobile: true, render: r => (r.starts_on || r.ends_on ? `${date(r.starts_on)} – ${date(r.ends_on)}` : 'Ongoing') },
    ];

    const save = async () => {
        if (!form.user_id || !form.duty) { toast.error('Choose a person and a duty.'); return; }
        setSaving(true);
        const ok = await create({
            user_id: form.user_id,
            duty: form.duty,
            scope_type: scope && form.scope_id ? scope : null,
            scope_id: scope && form.scope_id ? form.scope_id : null,
            starts_on: form.starts_on,
            ends_on: form.ends_on,
        }, 'Duty assigned.');
        setSaving(false);
        if (ok) { setOpen(false); setForm(EMPTY); }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                    <h2 className="text-base font-semibold text-foreground">Roles &amp; duties</h2>
                    <p className="text-sm text-muted-foreground">Give staff the jobs they do: a teacher can also be DOS or a patron; a bursar or nurse signs in as Staff and gets their module.</p>
                </div>
                <Button onClick={() => setOpen(true)}><Plus />Assign duty</Button>
            </div>

            <DataTable
                columns={columns}
                rows={rows}
                rowKey={r => r.id}
                loading={loading}
                emptyState="No duties assigned yet. Admins keep full access; teachers keep what they had."
                rowActions={r => (
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(r)} aria-label="Remove duty"><Trash2 className="text-destructive" /></Button>
                )}
            />

            <section>
                <h3 className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">What each duty can do</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {offered.map(k => (
                        <div key={k} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                            <p className="text-sm font-semibold text-foreground">{DUTIES[k].label}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{DUTIES[k].description}</p>
                        </div>
                    ))}
                </div>
            </section>

            <Modal
                isOpen={open}
                onClose={() => setOpen(false)}
                title="Assign a duty"
                size="lg"
                footer={<>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Assign'}</Button>
                </>}
            >
                <FormGrid>
                    <FormField label="Person" htmlFor="duty-user" required span="full">
                        <LookupSelect id="duty-user" lookup="staff" value={form.user_id} onChange={v => setForm(f => ({ ...f, user_id: v }))} />
                    </FormField>
                    <FormField label="Duty" htmlFor="duty-key" required hint={duty?.description} span="full">
                        <SelectField
                            id="duty-key"
                            value={form.duty}
                            onChange={v => setForm(f => ({ ...f, duty: v as DutyKey, scope_id: '' }))}
                            options={offered.map(k => ({ id: k, label: DUTIES[k].label }))}
                        />
                    </FormField>
                    {scope && (
                        <FormField label={`${SCOPE_LABELS[scope] ?? 'Scope'} (optional)`} htmlFor="duty-scope" hint="Leave empty for the whole school." span="full">
                            <SearchableSelect id="duty-scope" options={scopeOptions.options} loading={scopeOptions.loading} value={form.scope_id} onChange={v => setForm(f => ({ ...f, scope_id: v }))} clearable />
                        </FormField>
                    )}
                    <FormField label="From (optional)" htmlFor="duty-from">
                        <InputField id="duty-from" type="date" value={form.starts_on} onChange={e => setForm(f => ({ ...f, starts_on: e.target.value }))} />
                    </FormField>
                    <FormField label="Until (optional)" htmlFor="duty-to">
                        <InputField id="duty-to" type="date" value={form.ends_on} onChange={e => setForm(f => ({ ...f, ends_on: e.target.value }))} />
                    </FormField>
                </FormGrid>
            </Modal>

            <ConfirmDialog
                isOpen={deleting !== null}
                onClose={() => setDeleting(null)}
                onConfirm={async () => { if (deleting && await remove(deleting.id, 'Duty removed.')) setDeleting(null); }}
                title="Remove this duty?"
                message={deleting ? `${personName(deleting.user)} will no longer be ${DUTIES[deleting.duty]?.label ?? deleting.duty}.` : ''}
                confirmText="Remove"
                variant="danger"
            />
        </div>
    );
}
