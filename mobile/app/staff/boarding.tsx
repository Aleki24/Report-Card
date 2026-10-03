import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { admissionNo, date, dateTime, humanize, personName, studentName, today } from '@shared/ops/format';
import {
    ALLOCATION_FIELDS, DORM_DEFAULTS, DORM_FIELDS, DORM_GENDER_LABELS, EXEAT_DEFAULTS, EXEAT_FIELDS, EXEAT_TONES,
    allocationDefaults, exeatActionMessage, exeatActions, inspectionFields,
    type Allocation, type Dorm, type Exeat, type ExeatAction, type Inspection,
} from '@shared/ops/forms/welfare';
import { Button, Card, SectionLabel, TextField } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { FormSheet } from '@/components/ops/FormSheet';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { ActionButton, StatusPill } from '@/components/ops/bits';
import { RollCall } from '@/components/welfare/RollCall';
import { useApi, withQuery } from '@/lib/api';
import { opsGet, useOpsList } from '@/lib/ops';
import { errorMessage } from '@/lib/format';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, spacing, fonts } from '@/lib/theme';

function Allocations({ dorm, manage }: { dorm: Dorm; manage: boolean }) {
    return (
        <ResourceList<'dorm-allocations', Allocation>
            resource="dorm-allocations"
            params={{ dorm_id: dorm.id, current: '1' }}
            defaults={allocationDefaults(dorm.id)}
            fields={ALLOCATION_FIELDS}
            canCreate={manage}
            addLabel="Allocate bed"
            searchText={(a) => `${studentName(a.student)} ${admissionNo(a.student)} ${a.bed_label ?? ''}`}
            header={(rows) => <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>{rows.length} of {dorm.capacity || '—'} beds taken</Text>}
            title={(a) => studentName(a.student)}
            subtitle={(a) => `${admissionNo(a.student)} · bed ${a.bed_label ?? '—'} · since ${date(a.allocated_on)}`}
            rowActions={(a, reload) => (manage ? (
                <ActionButton path={`/api/ops/dorm-allocations/${a.id}`} method="PATCH" body={{ ended_on: today() }} success="Moved out." onDone={reload} variant="secondary" label="Move out" />
            ) : null)}
            emptyText="No learners in this dorm yet."
        />
    );
}

function GateCheck() {
    const api = useApi();
    const toast = useToast();
    const [code, setCode] = useState('');
    const [result, setResult] = useState<(Exeat & { valid: boolean }) | null>(null);
    const check = async () => {
        try { setResult(await opsGet<Exeat & { valid: boolean }>(api, withQuery('/api/welfare/exeats/verify', { code: code.trim() }))); }
        catch (err) { setResult(null); toast.error(errorMessage(err, 'Could not check the pass')); }
    };
    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, color: colors.foreground, marginBottom: spacing.sm }}>Gate check</Text>
            <TextField value={code} onChangeText={(v) => setCode(v.toUpperCase().slice(0, 6))} placeholder="Pass code" autoCapitalize="characters" />
            <Button label="Check" onPress={() => void check()} disabled={code.trim().length !== 6} />
            {result ? (
                <Text style={{ marginTop: spacing.sm, fontSize: 13, color: result.valid ? colors.success : colors.danger }}>
                    {studentName(result.student)} · {humanize(result.exeat_type)} · back by {dateTime(result.return_by)} — {result.valid ? 'valid' : `not valid (${humanize(result.status)})`}
                </Text>
            ) : null}
        </Card>
    );
}

function ExeatButton({ exeat, action, label, reload }: { exeat: Exeat; action: ExeatAction; label: string; reload: () => Promise<void> }) {
    const api = useApi();
    const toast = useToast();
    const [running, setRunning] = useState(false);
    const go = async () => {
        setRunning(true);
        try {
            const r = await api.post<{ data: { pass_code: string | null; notified?: boolean } }>(`/api/welfare/exeats/${exeat.id}/transition`, { action });
            toast.success(exeatActionMessage(action, r.data));
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not update the exeat'));
        } finally {
            setRunning(false);
        }
    };
    return <Button size="sm" label={label} loading={running} variant={action === 'REJECT' ? 'danger' : action === 'APPROVE' ? 'primary' : 'secondary'} onPress={() => void go()} />;
}

function Inspections({ canRecord }: { canRecord: boolean }) {
    const dorms = useOpsList<{ id: string; name: string }>('dorms');
    return (
        <ResourceList<'dorm-inspections', Inspection>
            resource="dorm-inspections"
            fields={inspectionFields(dorms.rows)}
            canCreate={canRecord}
            canEdit={canRecord}
            canDelete={canRecord}
            defaults={{ inspected_on: today() }}
            title={(i) => i.dorm?.name ?? 'Dorm'}
            subtitle={(i) => `${date(i.inspected_on)} · ${i.score}%`}
            details={(i) => [
                ['Remarks', i.remarks ?? '—'],
                ['Inspected by', personName(i.inspector)],
            ]}
        />
    );
}

export default function BoardingScreen() {
    const { can } = useCurrentUser();
    const manage = can('boarding.manage');
    const rollcall = can('boarding.rollcall') || manage;
    const [openDorm, setOpenDorm] = useState<Dorm | null>(null);

    return (
        <>
            <ModuleScreen
                screen="boarding"
                title="Boarding"
                description="Dorms and beds, roll calls, exeats with gate passes, and dorm inspections."
                tabs={[
                    { id: 'roll', label: 'Roll call', visible: rollcall, render: () => <RollCall /> },
                    {
                        id: 'exeats',
                        label: 'Exeats',
                        render: () => (
                            <View>
                                <GateCheck />
                                <SectionLabel>Exeats</SectionLabel>
                                <ResourceList<'exeats', Exeat>
                                    resource="exeats"
                                    fields={EXEAT_FIELDS}
                                    canCreate={manage || rollcall}
                                    canEdit={(e) => manage && e.status === 'PENDING'}
                                    canDelete={(e) => manage && e.status === 'PENDING'}
                                    defaults={EXEAT_DEFAULTS}
                                    addLabel="Request exeat"
                                    searchText={(e) => `${studentName(e.student)} ${admissionNo(e.student)} ${e.pass_code ?? ''}`}
                                    title={(e) => studentName(e.student)}
                                    subtitle={(e) => `${humanize(e.exeat_type)} · ${dateTime(e.leave_at)} – ${dateTime(e.return_by)}`}
                                    badge={(e) => <StatusPill status={e.status} tones={EXEAT_TONES} />}
                                    details={(e) => [
                                        ['Pass', e.pass_code ?? '—'],
                                        ['Reason', e.reason ?? '—'],
                                    ]}
                                    rowActions={(e, reload) => (
                                        <>
                                            {exeatActions(e.status, { manage, rollcall }).map((a) => (
                                                <ExeatButton key={a.action} exeat={e} action={a.action} label={a.label} reload={reload} />
                                            ))}
                                        </>
                                    )}
                                />
                            </View>
                        ),
                    },
                    {
                        id: 'dorms',
                        label: 'Dorms & beds',
                        render: () => (
                            <ResourceList<'dorms', Dorm>
                                resource="dorms"
                                fields={DORM_FIELDS}
                                canCreate={manage}
                                canEdit={manage}
                                canDelete={manage}
                                defaults={DORM_DEFAULTS}
                                onRowPress={setOpenDorm}
                                title={(d) => d.name}
                                subtitle={(d) => [d.house, (DORM_GENDER_LABELS as Record<string, string>)[d.gender]].filter(Boolean).join(' · ')}
                                details={(d) => [
                                    ['Beds', d.capacity],
                                    ['Patron', personName(d.patron)],
                                ]}
                                emptyText="Add dorms, then open one to allocate beds."
                            />
                        ),
                    },
                    { id: 'inspections', label: 'Inspections', render: () => <Inspections canRecord={rollcall} /> },
                ]}
            />
            <FormSheet visible={openDorm !== null} title={openDorm?.name ?? ''} onClose={() => setOpenDorm(null)}>
                {openDorm ? <Allocations key={openDorm.id} dorm={openDorm} manage={manage} /> : null}
            </FormSheet>
        </>
    );
}
