"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Activity, AlertTriangle, BedSingle, ClipboardList, FileHeart, HeartPulse, MessageSquare, Pill, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, date, dateTime, humanize, personName, studentName } from '@/lib/ops/format';
import {
    OUTCOME_TONES, PROFILE_FIELDS, STOCK_DEFAULTS, STOCK_FIELDS, VISIT_FIELDS, canDischarge, doseDefaults, doseFields,
    outbreakMessage, shouldTellParent, stockExpiring, stockLow, visitDefaults, visitOutcomeLabel,
    type Dose, type HealthStatus, type MedicalProfile, type Stock, type StatusVisit, type Visit,
} from '@/lib/ops/forms/welfare';

/** Today at a glance for any staff: who is in sick bay or went home, no clinical detail. */
function TodayPanel() {
    const [status, setStatus] = useState<HealthStatus | null>(null);
    useEffect(() => { opsFetch<HealthStatus>('/api/health/status').then(setStatus).catch(err => toast.error(errorText(err))); }, []);
    if (!status) return <div className="skeleton-bone h-48 rounded-2xl" />;
    const list = (rows: StatusVisit[], empty: string) => rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <ul className="flex flex-col gap-2">
            {rows.map(v => (
                <li key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm">
                    <span><span className="font-medium">{studentName(v.student)}</span> <span className="text-muted-foreground">{admissionNo(v.student)}</span></span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">{dateTime(v.visited_at)}<StatusPill status={v.outcome} tones={OUTCOME_TONES} /></span>
                </li>
            ))}
        </ul>
    );
    return (
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile icon={BedSingle} label="In sick bay" value={status.sickBay.length} hue="violet" />
                <StatTile icon={Activity} label="Sent home / referred today" value={status.wentHome.length} tone={status.wentHome.length > 0 ? 'warn' : 'default'} />
            </div>
            {outbreakMessage(status) && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <span>{outbreakMessage(status)}</span>
                </div>
            )}
            <section><h2 className="mb-2 text-sm font-semibold">Sick bay now</h2>{list(status.sickBay, 'Nobody is in sick bay.')}</section>
            <section><h2 className="mb-2 text-sm font-semibold">Sent home or referred today</h2>{list(status.wentHome, 'None today.')}</section>
            {status.trends.length > 0 && (
                <section>
                    <h2 className="mb-2 text-sm font-semibold">Common complaints (48 hours)</h2>
                    <p className="text-sm text-muted-foreground">{status.trends.map(t => `${t.complaint} ${t.visits}`).join(' · ')}</p>
                </section>
            )}
        </div>
    );
}

function StockPanel({ canManage }: { canManage: boolean }) {
    return (
        <ResourceManager<'medicine-stock', Stock>
            resource="medicine-stock"
            fields={STOCK_FIELDS}
            canCreate={canManage}
            canEdit={canManage}
            canDelete={canManage}
            defaults={STOCK_DEFAULTS}
            searchText={s => s.name}
            header={rows => {
                const low = rows.filter(stockLow).length;
                const expiring = rows.filter(stockExpiring).length;
                return (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile icon={Package} label="To reorder" value={low} tone={low > 0 ? 'warn' : 'good'} />
                        <StatTile icon={AlertTriangle} label="Expiring in 60 days" value={expiring} tone={expiring > 0 ? 'bad' : 'good'} />
                    </div>
                );
            }}
            columns={[
                { key: 'name', header: 'Medicine', render: s => <span className="font-medium">{s.name}</span> },
                { key: 'qty', header: 'In stock', numeric: true, render: s => <span className={stockLow(s) ? 'font-semibold text-amber-600' : ''}>{s.quantity} {s.unit}</span> },
                { key: 'expiry', header: 'Expiry', render: s => <span className={stockExpiring(s) ? 'text-destructive' : ''}>{date(s.expiry_date)}</span> },
                { key: 'batch', header: 'Batch', hideOnMobile: true, render: s => s.batch ?? '—' },
            ]}
        />
    );
}

function DosesPanel({ canManage }: { canManage: boolean }) {
    const stock = useOpsList<Stock>('medicine-stock');
    const fields = doseFields(stock.rows);
    return (
        <ResourceManager<'medication-logs', Dose>
            resource="medication-logs"
            fields={fields}
            canCreate={canManage}
            defaults={doseDefaults()}
            searchText={d => `${studentName(d.student)} ${d.medicine}`}
            columns={[
                { key: 'learner', header: 'Learner', render: d => <span className="font-medium">{studentName(d.student)}</span> },
                { key: 'med', header: 'Medicine', render: d => `${d.medicine}${d.dose ? ` · ${d.dose}` : ''}` },
                { key: 'when', header: 'Given', render: d => dateTime(d.given_at) },
                { key: 'by', header: 'By', hideOnMobile: true, render: d => personName(d.giver) },
            ]}
        />
    );
}

export default function HealthPage() {
    const { can } = useAuth();
    const clinical = can('health.clinical');
    const manage = can('health.manage');

    return (
        <ModulePage
            module="health"
            title="Health & sick bay"
            eyebrow="Welfare"
            description="Clinic visits, sick bay, medical profiles, medication and medicine stock. Clinical detail is visible only to the nurse and principal."
            icon={HeartPulse}
            hue="rose"
            tabs={[
                { id: 'today', label: 'Today', icon: Activity, hue: 'rose', render: () => <TodayPanel /> },
                {
                    id: 'visits', label: 'Clinic visits', shortLabel: 'Visits', icon: ClipboardList, hue: 'violet', visible: clinical,
                    render: () => (
                        <ResourceManager<'clinic-visits', Visit>
                            resource="clinic-visits"
                            fields={VISIT_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            defaults={visitDefaults()}
                            addLabel="Record visit"
                            searchText={v => `${studentName(v.student)} ${admissionNo(v.student)} ${v.complaint}`}
                            rowActions={(v, reload) => manage ? (
                                <>
                                    {canDischarge(v) && (
                                        <Button size="xs" variant="outline" onClick={async () => {
                                            try { await opsFetch(`/api/ops/clinic-visits/${v.id}`, { method: 'PATCH', json: { discharged_at: new Date().toISOString() } }); toast.success('Discharged.'); await reload(); }
                                            catch (err) { toast.error(errorText(err)); }
                                        }}>Discharge</Button>
                                    )}
                                    {shouldTellParent(v) && (
                                        <Button size="xs" onClick={async () => {
                                            try { await opsFetch(`/api/health/visits/${v.id}/notify`, { method: 'POST' }); toast.success('Guardian notified by SMS.'); await reload(); }
                                            catch (err) { toast.error(errorText(err)); }
                                        }}><MessageSquare />Tell parent</Button>
                                    )}
                                </>
                            ) : null}
                            columns={[
                                { key: 'learner', header: 'Learner', render: v => <span className="font-medium">{studentName(v.student)}</span> },
                                { key: 'complaint', header: 'Complaint', render: v => <span className="line-clamp-1">{v.complaint}{v.temperature_c ? ` · ${v.temperature_c}°C` : ''}</span> },
                                { key: 'when', header: 'When', hideOnMobile: true, render: v => dateTime(v.visited_at) },
                                { key: 'outcome', header: 'Outcome', render: v => <StatusPill status={v.outcome} tones={OUTCOME_TONES} label={visitOutcomeLabel(v) ?? humanize(v.outcome)} /> },
                            ]}
                        />
                    ),
                },
                {
                    id: 'profiles', label: 'Medical profiles', shortLabel: 'Profiles', icon: FileHeart, hue: 'blue', visible: clinical,
                    render: () => (
                        <ResourceManager<'medical-profiles', MedicalProfile>
                            resource="medical-profiles"
                            fields={PROFILE_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            searchText={p => `${studentName(p.student)} ${admissionNo(p.student)} ${p.allergies ?? ''} ${p.conditions ?? ''}`}
                            columns={[
                                { key: 'learner', header: 'Learner', render: p => <span className="font-medium">{studentName(p.student)}</span> },
                                { key: 'allergies', header: 'Allergies', render: p => p.allergies ?? '—' },
                                { key: 'conditions', header: 'Conditions', hideOnMobile: true, render: p => p.conditions ?? '—' },
                                { key: 'blood', header: 'Blood', hideOnMobile: true, render: p => p.blood_group ?? '—' },
                                { key: 'consent', header: 'Consent', hideOnMobile: true, render: p => (p.consent_on_file ? 'Yes' : 'No') },
                            ]}
                        />
                    ),
                },
                { id: 'doses', label: 'Medication given', shortLabel: 'Doses', icon: Pill, hue: 'emerald', visible: clinical, render: () => <DosesPanel canManage={manage} /> },
                { id: 'stock', label: 'Medicine stock', shortLabel: 'Stock', icon: Package, hue: 'amber', visible: clinical, render: () => <StockPanel canManage={manage} /> },
            ]}
        />
    );
}
