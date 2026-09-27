"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { BedDouble, ClipboardCheck, DoorOpen, LogIn, LogOut, ScanLine, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { InputField } from '@/components/ui/FormField';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { RollCallPanel } from '@/components/welfare/RollCallPanel';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, date, dateTime, humanize, personName, studentName, today } from '@/lib/ops/format';
import type { PersonName, StudentEmbed } from '@/lib/ops/resource';
import { DORM_GENDERS, EXEAT_TYPES, type ExeatStatus } from '@/lib/ops/resources/welfare';

interface Dorm { id: string; name: string; house: string | null; gender: string; capacity: number; patron: PersonName | null }
interface Allocation { id: string; bed_label: string | null; allocated_on: string; student: StudentEmbed | null }
interface Exeat { id: string; exeat_type: string; leave_at: string; return_by: string; reason: string | null; status: ExeatStatus; pass_code: string | null; student: StudentEmbed | null; requester: PersonName | null }
interface Inspection { id: string; inspected_on: string; score: number; remarks: string | null; dorm: { name: string } | null; inspector: PersonName | null }

const EXEAT_TONES: Record<ExeatStatus, PillTone> = { PENDING: 'warn', APPROVED: 'info', REJECTED: 'bad', OUT: 'violet', RETURNED: 'good' };

const DORM_FIELDS: readonly FieldDef<FieldName<'dorms'>>[] = [
    { name: 'name', label: 'Dorm name', kind: 'text', required: true },
    { name: 'house', label: 'House', kind: 'text' },
    { name: 'gender', label: 'For', kind: 'enum', values: DORM_GENDERS, required: true, labels: { MALE: 'Boys', FEMALE: 'Girls', MIXED: 'Mixed' } },
    { name: 'capacity', label: 'Beds', kind: 'number' },
    { name: 'patron_id', label: 'Patron / house master', kind: 'lookup', lookup: 'staff', span: 'full' },
];

const EXEAT_FIELDS: readonly FieldDef<FieldName<'exeats'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'exeat_type', label: 'Type', kind: 'enum', values: EXEAT_TYPES, required: true },
    { name: 'leave_at', label: 'Leaving', kind: 'datetime', required: true },
    { name: 'return_by', label: 'Back by', kind: 'datetime', required: true },
    { name: 'reason', label: 'Reason', kind: 'textarea' },
];

function Allocations({ dorm, canManage }: { dorm: Dorm; canManage: boolean }) {
    return (
        <ResourceManager<'dorm-allocations', Allocation>
            resource="dorm-allocations"
            params={{ dorm_id: dorm.id, current: '1' }}
            defaults={{ dorm_id: dorm.id, allocated_on: today() }}
            fields={[
                { name: 'dorm_id', label: 'Dorm', kind: 'hidden' },
                { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
                { name: 'bed_label', label: 'Bed / cubicle', kind: 'text' },
                { name: 'allocated_on', label: 'From', kind: 'date', required: true },
            ]}
            canCreate={canManage}
            addLabel="Allocate bed"
            searchText={a => `${studentName(a.student)} ${admissionNo(a.student)} ${a.bed_label ?? ''}`}
            header={rows => <p className="text-sm text-muted-foreground">{rows.length} of {dorm.capacity || '—'} beds taken</p>}
            rowActions={(a, reload) => canManage ? (
                <Button size="xs" variant="outline" onClick={async () => {
                    try { await opsFetch(`/api/ops/dorm-allocations/${a.id}`, { method: 'PATCH', json: { ended_on: today() } }); toast.success('Moved out.'); await reload(); }
                    catch (err) { toast.error(errorText(err)); }
                }}>Move out</Button>
            ) : null}
            columns={[
                { key: 'learner', header: 'Learner', render: a => <span className="font-medium">{studentName(a.student)}</span> },
                { key: 'adm', header: 'Adm no.', render: a => admissionNo(a.student) },
                { key: 'bed', header: 'Bed', render: a => a.bed_label ?? '—' },
                { key: 'since', header: 'Since', hideOnMobile: true, render: a => date(a.allocated_on) },
            ]}
            emptyText="No learners in this dorm yet."
        />
    );
}

function GateCheck() {
    const [code, setCode] = useState('');
    const [result, setResult] = useState<(Exeat & { valid: boolean }) | null>(null);
    const check = async () => {
        try { setResult(await opsFetch(`/api/welfare/exeats/verify?code=${encodeURIComponent(code)}`)); }
        catch (err) { setResult(null); toast.error(errorText(err)); }
    };
    return (
        <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ScanLine className="size-4" aria-hidden />Gate check</h3>
            <div className="flex gap-2">
                <InputField aria-label="Pass code" value={code} maxLength={6} placeholder="Pass code" className="uppercase sm:max-w-40" onChange={e => setCode(e.target.value)} />
                <Button onClick={check} disabled={code.trim().length !== 6}>Check</Button>
            </div>
            {result && (
                <p className={result.valid ? 'text-sm text-emerald-700 dark:text-emerald-400' : 'text-sm text-destructive'}>
                    {studentName(result.student)} · {humanize(result.exeat_type)} · back by {dateTime(result.return_by)} — {result.valid ? 'valid' : `not valid (${humanize(result.status)})`}
                </p>
            )}
        </section>
    );
}

export default function BoardingPage() {
    const { can } = useAuth();
    const manage = can('boarding.manage');
    const rollcall = can('boarding.rollcall') || manage;
    const [openDorm, setOpenDorm] = useState<Dorm | null>(null);

    const exeatAction = async (id: string, action: 'APPROVE' | 'REJECT' | 'CHECK_OUT' | 'CHECK_IN', reload: () => Promise<void>) => {
        try {
            const r = await opsFetch<{ pass_code: string | null; notified?: boolean }>(`/api/welfare/exeats/${id}/transition`, { method: 'POST', json: { action } });
            toast.success(action === 'APPROVE' ? `Approved. Gate pass code: ${r.pass_code}` : action === 'CHECK_OUT' || action === 'CHECK_IN' ? `Recorded${r.notified ? '; guardian notified' : ''}.` : 'Rejected.');
            await reload();
        } catch (err) { toast.error(errorText(err)); }
    };

    return (
        <>
            <ModulePage
                module="boarding"
                title="Boarding"
                eyebrow="Welfare"
                description="Dorms and beds, roll calls, exeats with gate passes, and dorm inspections."
                icon={BedDouble}
                hue="amber"
                tabs={[
                    { id: 'roll', label: 'Roll call', icon: ClipboardCheck, hue: 'amber', visible: rollcall, render: () => <RollCallPanel /> },
                    {
                        id: 'exeats', label: 'Exeats', icon: DoorOpen, hue: 'sky',
                        render: () => (
                            <div className="flex flex-col gap-5">
                                <GateCheck />
                                <ResourceManager<'exeats', Exeat>
                                    resource="exeats"
                                    fields={EXEAT_FIELDS}
                                    canCreate={manage || rollcall}
                                    canEdit={e => manage && e.status === 'PENDING'}
                                    canDelete={e => manage && e.status === 'PENDING'}
                                    defaults={{ exeat_type: 'WEEKEND' }}
                                    addLabel="Request exeat"
                                    searchText={e => `${studentName(e.student)} ${admissionNo(e.student)} ${e.pass_code ?? ''}`}
                                    rowActions={(e, reload) => (
                                        <>
                                            {manage && e.status === 'PENDING' && <Button size="xs" onClick={() => void exeatAction(e.id, 'APPROVE', reload)}>Approve</Button>}
                                            {manage && (e.status === 'PENDING' || e.status === 'APPROVED') && <Button size="xs" variant="destructive" onClick={() => void exeatAction(e.id, 'REJECT', reload)}>Reject</Button>}
                                            {rollcall && e.status === 'APPROVED' && <Button size="xs" variant="outline" onClick={() => void exeatAction(e.id, 'CHECK_OUT', reload)}><LogOut />Out</Button>}
                                            {rollcall && e.status === 'OUT' && <Button size="xs" variant="outline" onClick={() => void exeatAction(e.id, 'CHECK_IN', reload)}><LogIn />Back</Button>}
                                        </>
                                    )}
                                    columns={[
                                        { key: 'learner', header: 'Learner', render: e => <span className="font-medium">{studentName(e.student)}</span> },
                                        { key: 'when', header: 'Out – back', render: e => `${dateTime(e.leave_at)} – ${dateTime(e.return_by)}` },
                                        { key: 'type', header: 'Type', hideOnMobile: true, render: e => humanize(e.exeat_type) },
                                        { key: 'code', header: 'Pass', hideOnMobile: true, render: e => e.pass_code ? <code className="font-mono text-xs">{e.pass_code}</code> : '—' },
                                        { key: 'status', header: 'Status', render: e => <StatusPill status={e.status} tones={EXEAT_TONES} /> },
                                    ]}
                                />
                            </div>
                        ),
                    },
                    {
                        id: 'dorms', label: 'Dorms & beds', shortLabel: 'Dorms', icon: BedDouble, hue: 'violet',
                        render: () => (
                            <ResourceManager<'dorms', Dorm>
                                resource="dorms"
                                fields={DORM_FIELDS}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={{ gender: 'MIXED' }}
                                onRowClick={setOpenDorm}
                                columns={[
                                    { key: 'name', header: 'Dorm', render: d => <span className="font-medium">{d.name}</span> },
                                    { key: 'house', header: 'House', render: d => d.house ?? '—' },
                                    { key: 'for', header: 'For', hideOnMobile: true, render: d => ({ MALE: 'Boys', FEMALE: 'Girls', MIXED: 'Mixed' } as Record<string, string>)[d.gender] },
                                    { key: 'beds', header: 'Beds', numeric: true, render: d => d.capacity },
                                    { key: 'patron', header: 'Patron', hideOnMobile: true, render: d => personName(d.patron) },
                                ]}
                                emptyText="Add dorms, then open one to allocate beds."
                            />
                        ),
                    },
                    {
                        id: 'inspections', label: 'Inspections', icon: Sparkles, hue: 'emerald',
                        render: () => <Inspections canRecord={rollcall} />,
                    },
                ]}
            />
            <Drawer isOpen={openDorm !== null} onClose={() => setOpenDorm(null)} title={openDorm?.name ?? ''} size="lg">
                {openDorm && <Allocations key={openDorm.id} dorm={openDorm} canManage={manage} />}
            </Drawer>
        </>
    );
}

function Inspections({ canRecord }: { canRecord: boolean }) {
    const dorms = useOpsList<{ id: string; name: string }>('dorms');
    const fields: readonly FieldDef<FieldName<'dorm-inspections'>>[] = [
        { name: 'dorm_id', label: 'Dorm', kind: 'options', options: dorms.rows.map(d => ({ id: d.id, label: d.name })), required: true },
        { name: 'inspected_on', label: 'Date', kind: 'date', required: true },
        { name: 'score', label: 'Score (0–100)', kind: 'number', required: true },
        { name: 'remarks', label: 'Remarks', kind: 'textarea' },
    ];
    return (
        <ResourceManager<'dorm-inspections', Inspection>
            resource="dorm-inspections"
            fields={fields}
            canCreate={canRecord}
            canEdit={canRecord}
            canDelete={canRecord}
            defaults={{ inspected_on: today() }}
            columns={[
                { key: 'dorm', header: 'Dorm', render: i => <span className="font-medium">{i.dorm?.name}</span> },
                { key: 'date', header: 'Date', render: i => date(i.inspected_on) },
                { key: 'score', header: 'Score', numeric: true, render: i => `${i.score}%` },
                { key: 'by', header: 'Inspected by', hideOnMobile: true, render: i => personName(i.inspector) },
            ]}
        />
    );
}
