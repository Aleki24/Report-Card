import React from 'react';
import { Text, View } from 'react-native';
import { admissionNo, date, dateTime, humanize, personName, studentName } from '@shared/ops/format';
import {
    OUTCOME_TONES, PROFILE_FIELDS, STOCK_DEFAULTS, STOCK_FIELDS, VISIT_FIELDS, canDischarge, doseDefaults, doseFields,
    outbreakMessage, shouldTellParent, stockExpiring, stockLow, visitDefaults, visitOutcomeLabel,
    type Dose, type HealthStatus, type MedicalProfile, type Stock, type StatusVisit, type Visit,
} from '@shared/ops/forms/welfare';
import { ErrorBanner, ListCard, ListRow, LoadingView, Notice, SectionLabel, StatGrid, StatTile } from '@/components/ui';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { ActionButton, StatusPill, toneColor, useRefreshSignal } from '@/components/ops/bits';
import { useOpsData, useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { colors } from '@/lib/theme';

/** Today at a glance for any staff: who is in sick bay or went home, no clinical detail. */
function Today() {
    const { data: status, loading, error, reload } = useOpsData<HealthStatus>('/api/health/status');
    useRefreshSignal(reload);
    if (loading && !status) return <LoadingView />;
    if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;
    if (!status) return null;
    const outbreak = outbreakMessage(status);
    const list = (rows: StatusVisit[], empty: string) => rows.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>{empty}</Text>
    ) : (
        <ListCard>
            {rows.map((v) => (
                <ListRow key={v.id} title={studentName(v.student)} subtitle={`${admissionNo(v.student)} · ${dateTime(v.visited_at)}`} right={<StatusPill status={v.outcome} tones={OUTCOME_TONES} />} />
            ))}
        </ListCard>
    );
    return (
        <View>
            <StatGrid>
                <StatTile label="In sick bay" value={status.sickBay.length} tone={toneColor('violet')} />
                <StatTile label="Sent home / referred today" value={status.wentHome.length} tone={status.wentHome.length > 0 ? toneColor('warn') : undefined} />
            </StatGrid>
            {outbreak ? <View style={{ marginTop: 12 }}><Notice tone="danger" message={outbreak} /></View> : null}
            <SectionLabel>Sick bay now</SectionLabel>
            {list(status.sickBay, 'Nobody is in sick bay.')}
            <SectionLabel>Sent home or referred today</SectionLabel>
            {list(status.wentHome, 'None today.')}
            {status.trends.length > 0 ? (
                <>
                    <SectionLabel>Common complaints (48 hours)</SectionLabel>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{status.trends.map((t) => `${t.complaint} ${t.visits}`).join(' · ')}</Text>
                </>
            ) : null}
        </View>
    );
}

function Doses({ manage }: { manage: boolean }) {
    const stock = useOpsList<Stock>('medicine-stock');
    return (
        <ResourceList<'medication-logs', Dose>
            resource="medication-logs"
            fields={doseFields(stock.rows)}
            canCreate={manage}
            defaults={doseDefaults()}
            searchText={(d) => `${studentName(d.student)} ${d.medicine}`}
            title={(d) => studentName(d.student)}
            subtitle={(d) => `${d.medicine}${d.dose ? ` · ${d.dose}` : ''}`}
            details={(d) => [
                ['Given', dateTime(d.given_at)],
                ['By', personName(d.giver)],
            ]}
        />
    );
}

export default function HealthScreen() {
    const { can } = useCurrentUser();
    const clinical = can('health.clinical');
    const manage = can('health.manage');

    return (
        <ModuleScreen
            screen="health"
            title="Health & sick bay"
            description="Clinic visits, sick bay, medical profiles, medication and medicine stock. Clinical detail is visible only to the nurse and principal."
            tabs={[
                { id: 'today', label: 'Today', render: () => <Today /> },
                {
                    id: 'visits',
                    label: 'Visits',
                    visible: clinical,
                    render: () => (
                        <ResourceList<'clinic-visits', Visit>
                            resource="clinic-visits"
                            fields={VISIT_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            defaults={visitDefaults()}
                            addLabel="Record visit"
                            searchText={(v) => `${studentName(v.student)} ${admissionNo(v.student)} ${v.complaint}`}
                            title={(v) => studentName(v.student)}
                            subtitle={(v) => `${v.complaint}${v.temperature_c ? ` · ${v.temperature_c}°C` : ''}`}
                            badge={(v) => <StatusPill status={v.outcome} tones={OUTCOME_TONES} label={visitOutcomeLabel(v) ?? humanize(v.outcome)} />}
                            details={(v) => [
                                ['When', dateTime(v.visited_at)],
                                ['Assessment', v.diagnosis ?? '—'],
                                ['Treatment', v.treatment ?? '—'],
                                ...(v.referred_to ? [['Referred to', v.referred_to] as const] : []),
                            ]}
                            rowActions={(v, reload) => (manage ? (
                                <>
                                    {canDischarge(v) ? (
                                        <ActionButton path={`/api/ops/clinic-visits/${v.id}`} method="PATCH" body={{ discharged_at: new Date().toISOString() }} success="Discharged." onDone={reload} variant="secondary" label="Discharge" />
                                    ) : null}
                                    {shouldTellParent(v) ? (
                                        <ActionButton path={`/api/health/visits/${v.id}/notify`} success="Guardian notified by SMS." onDone={reload} label="Tell parent" />
                                    ) : null}
                                </>
                            ) : null)}
                        />
                    ),
                },
                {
                    id: 'profiles',
                    label: 'Profiles',
                    visible: clinical,
                    render: () => (
                        <ResourceList<'medical-profiles', MedicalProfile>
                            resource="medical-profiles"
                            fields={PROFILE_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            searchText={(p) => `${studentName(p.student)} ${admissionNo(p.student)} ${p.allergies ?? ''} ${p.conditions ?? ''}`}
                            title={(p) => studentName(p.student)}
                            subtitle={(p) => admissionNo(p.student)}
                            details={(p) => [
                                ['Allergies', p.allergies ?? '—'],
                                ['Conditions', p.conditions ?? '—'],
                                ['Blood group', p.blood_group ?? '—'],
                                ['Emergency phone', p.emergency_phone ?? '—'],
                                ['Consent on file', p.consent_on_file ? 'Yes' : 'No'],
                            ]}
                        />
                    ),
                },
                { id: 'doses', label: 'Doses', visible: clinical, render: () => <Doses manage={manage} /> },
                {
                    id: 'stock',
                    label: 'Stock',
                    visible: clinical,
                    render: () => (
                        <ResourceList<'medicine-stock', Stock>
                            resource="medicine-stock"
                            fields={STOCK_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={STOCK_DEFAULTS}
                            searchText={(s) => s.name}
                            header={(rows) => {
                                const low = rows.filter(stockLow).length;
                                const expiring = rows.filter(stockExpiring).length;
                                return (
                                    <StatGrid>
                                        <StatTile label="To reorder" value={low} tone={toneColor(low > 0 ? 'warn' : 'good')} />
                                        <StatTile label="Expiring in 60 days" value={expiring} tone={toneColor(expiring > 0 ? 'bad' : 'good')} />
                                    </StatGrid>
                                );
                            }}
                            title={(s) => s.name}
                            subtitle={(s) => `${s.quantity} ${s.unit}${stockLow(s) ? ' · reorder' : ''}`}
                            details={(s) => [
                                ['Expiry', `${date(s.expiry_date)}${stockExpiring(s) ? ' ⚠︎' : ''}`],
                                ['Batch', s.batch ?? '—'],
                            ]}
                        />
                    ),
                },
            ]}
        />
    );
}
