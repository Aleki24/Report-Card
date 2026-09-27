"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Activity, AlertTriangle, BedSingle, ClipboardList, FileHeart, HeartPulse, MessageSquare, Pill, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, date, dateTime, daysUntil, humanize, personName, studentName } from '@/lib/ops/format';
import type { PersonName, StudentEmbed } from '@/lib/ops/resource';
import { BLOOD_GROUPS, VISIT_OUTCOMES, type VisitOutcome } from '@/lib/ops/resources/welfare';

interface Visit {
    id: string; visited_at: string; complaint: string; temperature_c: number | null; diagnosis: string | null; treatment: string | null;
    outcome: VisitOutcome; referred_to: string | null; parent_notified: boolean; discharged_at: string | null;
    student: StudentEmbed | null; attendant: PersonName | null;
}
interface StatusVisit { id: string; visited_at: string; outcome: VisitOutcome; student: StudentEmbed | null }
interface Status { sickBay: StatusVisit[]; wentHome: StatusVisit[]; trends: { complaint: string; visits: number; alert: boolean }[] }
interface Profile { id: string; blood_group: string | null; allergies: string | null; conditions: string | null; regular_medication: string | null; emergency_phone: string | null; consent_on_file: boolean; student: StudentEmbed | null }
interface Stock { id: string; name: string; unit: string; quantity: number; reorder_level: number; batch: string | null; expiry_date: string | null }
interface Dose { id: string; medicine: string; dose: string | null; quantity: number; given_at: string; student: StudentEmbed | null; giver: PersonName | null }

const OUTCOME_TONES: Record<VisitOutcome, PillTone> = { RETURNED_TO_CLASS: 'good', SICK_BAY: 'violet', SENT_HOME: 'warn', REFERRED: 'bad' };
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const VISIT_FIELDS: readonly FieldDef<FieldName<'clinic-visits'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'visited_at', label: 'Time', kind: 'datetime', required: true },
    { name: 'temperature_c', label: 'Temperature (°C)', kind: 'number', step: '0.1' },
    { name: 'complaint', label: 'Complaint', kind: 'text', required: true, span: 'full' },
    { name: 'diagnosis', label: 'Assessment', kind: 'textarea' },
    { name: 'treatment', label: 'Treatment given', kind: 'textarea' },
    { name: 'outcome', label: 'Outcome', kind: 'enum', values: VISIT_OUTCOMES, required: true },
    { name: 'referred_to', label: 'Referred to', kind: 'text', hint: 'Hospital or clinic, if referred.' },
];

const PROFILE_FIELDS: readonly FieldDef<FieldName<'medical-profiles'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'blood_group', label: 'Blood group', kind: 'enum', values: BLOOD_GROUPS, labels: Object.fromEntries(BLOOD_GROUPS.map(b => [b, b])) },
    { name: 'sha_number', label: 'SHA number', kind: 'text' },
    { name: 'allergies', label: 'Allergies', kind: 'textarea' },
    { name: 'conditions', label: 'Chronic conditions', kind: 'textarea', hint: 'Asthma, diabetes, sickle cell, epilepsy…' },
    { name: 'regular_medication', label: 'Regular medication', kind: 'textarea' },
    { name: 'doctor_name', label: 'Family doctor', kind: 'text' },
    { name: 'doctor_phone', label: 'Doctor phone', kind: 'tel' },
    { name: 'emergency_contact', label: 'Emergency contact', kind: 'text' },
    { name: 'emergency_phone', label: 'Emergency phone', kind: 'tel' },
    { name: 'consent_on_file', label: 'Treatment consent form on file', kind: 'checkbox' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];

const STOCK_FIELDS: readonly FieldDef<FieldName<'medicine-stock'>>[] = [
    { name: 'name', label: 'Medicine', kind: 'text', required: true, span: 'full' },
    { name: 'unit', label: 'Unit', kind: 'text', required: true, placeholder: 'tablet, bottle, sachet' },
    { name: 'quantity', label: 'In stock', kind: 'number', required: true },
    { name: 'reorder_level', label: 'Reorder at', kind: 'number' },
    { name: 'batch', label: 'Batch', kind: 'text' },
    { name: 'expiry_date', label: 'Expiry', kind: 'date' },
];

/** Today at a glance for any staff: who is in sick bay or went home, no clinical detail. */
function TodayPanel() {
    const [status, setStatus] = useState<Status | null>(null);
    useEffect(() => { opsFetch<Status>('/api/health/status').then(setStatus).catch(err => toast.error(errorText(err))); }, []);
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
            {status.trends.some(t => t.alert) && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <span>Possible outbreak: {status.trends.filter(t => t.alert).map(t => `“${t.complaint}” (${t.visits} visits in 48h)`).join(', ')}. Inform the principal.</span>
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
            defaults={{ unit: 'tablet', reorder_level: '0' }}
            searchText={s => s.name}
            header={rows => {
                const low = rows.filter(r => r.quantity <= r.reorder_level).length;
                const expiring = rows.filter(r => { const d = daysUntil(r.expiry_date); return d !== null && d <= 60; }).length;
                return (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatTile icon={Package} label="To reorder" value={low} tone={low > 0 ? 'warn' : 'good'} />
                        <StatTile icon={AlertTriangle} label="Expiring in 60 days" value={expiring} tone={expiring > 0 ? 'bad' : 'good'} />
                    </div>
                );
            }}
            columns={[
                { key: 'name', header: 'Medicine', render: s => <span className="font-medium">{s.name}</span> },
                { key: 'qty', header: 'In stock', numeric: true, render: s => <span className={s.quantity <= s.reorder_level ? 'font-semibold text-amber-600' : ''}>{s.quantity} {s.unit}</span> },
                { key: 'expiry', header: 'Expiry', render: s => { const d = daysUntil(s.expiry_date); return <span className={d !== null && d <= 60 ? 'text-destructive' : ''}>{date(s.expiry_date)}</span>; } },
                { key: 'batch', header: 'Batch', hideOnMobile: true, render: s => s.batch ?? '—' },
            ]}
        />
    );
}

function DosesPanel({ canManage }: { canManage: boolean }) {
    const stock = useOpsList<Stock>('medicine-stock');
    const fields: readonly FieldDef<FieldName<'medication-logs'>>[] = [
        { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
        { name: 'stock_id', label: 'From stock', kind: 'options', options: stock.rows.map(s => ({ id: s.id, label: s.name, hint: `${s.quantity} ${s.unit} left` })), hint: 'Takes the quantity off the shelf.' },
        { name: 'medicine', label: 'Medicine', kind: 'text', required: true },
        { name: 'dose', label: 'Dose', kind: 'text', placeholder: 'e.g. 500mg' },
        { name: 'quantity', label: 'Quantity', kind: 'number' },
        { name: 'given_at', label: 'Given at', kind: 'datetime', required: true },
        { name: 'notes', label: 'Notes', kind: 'textarea' },
    ];
    return (
        <ResourceManager<'medication-logs', Dose>
            resource="medication-logs"
            fields={fields}
            canCreate={canManage}
            defaults={{ quantity: '1', given_at: nowLocal() }}
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
                            defaults={{ visited_at: nowLocal(), outcome: 'RETURNED_TO_CLASS' }}
                            addLabel="Record visit"
                            searchText={v => `${studentName(v.student)} ${admissionNo(v.student)} ${v.complaint}`}
                            rowActions={(v, reload) => manage ? (
                                <>
                                    {v.outcome === 'SICK_BAY' && !v.discharged_at && (
                                        <Button size="xs" variant="outline" onClick={async () => {
                                            try { await opsFetch(`/api/ops/clinic-visits/${v.id}`, { method: 'PATCH', json: { discharged_at: new Date().toISOString() } }); toast.success('Discharged.'); await reload(); }
                                            catch (err) { toast.error(errorText(err)); }
                                        }}>Discharge</Button>
                                    )}
                                    {!v.parent_notified && v.outcome !== 'RETURNED_TO_CLASS' && (
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
                                { key: 'outcome', header: 'Outcome', render: v => <StatusPill status={v.outcome} tones={OUTCOME_TONES} label={v.outcome === 'SICK_BAY' && v.discharged_at ? 'Discharged' : humanize(v.outcome)} /> },
                            ]}
                        />
                    ),
                },
                {
                    id: 'profiles', label: 'Medical profiles', shortLabel: 'Profiles', icon: FileHeart, hue: 'blue', visible: clinical,
                    render: () => (
                        <ResourceManager<'medical-profiles', Profile>
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
