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
import { StatusPill } from '@/components/ops/StatusPill';
import { RollCallPanel } from '@/components/welfare/RollCallPanel';
import { useOpsList } from '@/hooks/useOpsList';
import { errorText, opsFetch } from '@/lib/ops/client';
import { admissionNo, date, dateTime, humanize, personName, studentName, today } from '@/lib/ops/format';
import {
    ALLOCATION_FIELDS, DORM_DEFAULTS, DORM_FIELDS, DORM_GENDER_LABELS, EXEAT_DEFAULTS, EXEAT_FIELDS, EXEAT_TONES,
    allocationDefaults, exeatActionMessage, exeatActions, inspectionFields,
    type Allocation, type Dorm, type Exeat, type ExeatAction, type Inspection,
} from '@/lib/ops/forms/welfare';

function Allocations({ dorm, canManage }: { dorm: Dorm; canManage: boolean }) {
    return (
        <ResourceManager<'dorm-allocations', Allocation>
            resource="dorm-allocations"
            params={{ dorm_id: dorm.id, current: '1' }}
            defaults={allocationDefaults(dorm.id)}
            fields={ALLOCATION_FIELDS}
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

    const exeatAction = async (id: string, action: ExeatAction, reload: () => Promise<void>) => {
        try {
            const r = await opsFetch<{ pass_code: string | null; notified?: boolean }>(`/api/welfare/exeats/${id}/transition`, { method: 'POST', json: { action } });
            toast.success(exeatActionMessage(action, r));
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
                                    defaults={EXEAT_DEFAULTS}
                                    addLabel="Request exeat"
                                    searchText={e => `${studentName(e.student)} ${admissionNo(e.student)} ${e.pass_code ?? ''}`}
                                    rowActions={(e, reload) => (
                                        <>
                                            {exeatActions(e.status, { manage, rollcall }).map(a => (
                                                <Button key={a.action} size="xs" variant={a.action === 'REJECT' ? 'destructive' : a.action === 'APPROVE' ? 'default' : 'outline'} onClick={() => void exeatAction(e.id, a.action, reload)}>
                                                    {a.action === 'CHECK_OUT' && <LogOut />}{a.action === 'CHECK_IN' && <LogIn />}{a.label}
                                                </Button>
                                            ))}
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
                                defaults={DORM_DEFAULTS}
                                onRowClick={setOpenDorm}
                                columns={[
                                    { key: 'name', header: 'Dorm', render: d => <span className="font-medium">{d.name}</span> },
                                    { key: 'house', header: 'House', render: d => d.house ?? '—' },
                                    { key: 'for', header: 'For', hideOnMobile: true, render: d => (DORM_GENDER_LABELS as Record<string, string>)[d.gender] },
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
    const fields = inspectionFields(dorms.rows);
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
