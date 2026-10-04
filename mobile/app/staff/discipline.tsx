import React from 'react';
import { Text } from 'react-native';
import { admissionNo, date, humanize, personName, studentName } from '@shared/ops/format';
import {
    INCIDENT_MANAGE_FIELDS, INCIDENT_REPORT_FIELDS, INCIDENT_STATUS_TONES, SEVERITY_TONES, incidentDefaults, type Incident,
} from '@shared/ops/forms/welfare';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { ActionButton, StatusPill } from '@/components/ops/bits';
import { useCurrentUser } from '@/lib/UserContext';
import { spacing, useTheme } from '@/lib/theme';

export default function DisciplineScreen() {
    const { colors } = useTheme();
    const { can, profile } = useCurrentUser();
    const manage = can('discipline.manage');
    const record = can('discipline.record') || manage;
    const mine = (i: Incident) => i.reported_by === profile?.id;
    return (
        <ModuleScreen
            screen="discipline"
            title="Discipline"
            description="Teachers report incidents; the discipline master records the action taken and informs parents."
            tabs={[{
                id: 'incidents',
                label: 'Incidents',
                render: () => (
                    <ResourceList<'discipline', Incident>
                        resource="discipline"
                        fields={manage ? INCIDENT_MANAGE_FIELDS : INCIDENT_REPORT_FIELDS}
                        canCreate={record}
                        canEdit={(i) => manage || (mine(i) && i.status === 'OPEN')}
                        canDelete={(i) => manage || (mine(i) && i.status === 'OPEN')}
                        defaults={incidentDefaults()}
                        addLabel="Report incident"
                        searchText={(i) => `${studentName(i.student)} ${admissionNo(i.student)} ${i.category} ${i.description}`}
                        header={() => (!manage ? (
                            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>You see the incidents you reported. The discipline master decides the action.</Text>
                        ) : null)}
                        title={(i) => studentName(i.student)}
                        subtitle={(i) => `${humanize(i.category)} · ${date(i.occurred_on)}`}
                        badge={(i) => <StatusPill status={i.status} tones={INCIDENT_STATUS_TONES} />}
                        details={(i) => [
                            ['Severity', humanize(i.severity)],
                            ['What happened', i.description],
                            ['Action', humanize(i.action_taken)],
                            ['Reported by', personName(i.reporter)],
                            ['Parent told', i.parent_notified ? 'Yes' : 'No'],
                        ]}
                        rowActions={(i, reload) => (
                            <>
                                <StatusPill status={i.severity} tones={SEVERITY_TONES} />
                                {manage && !i.parent_notified ? (
                                    <ActionButton path={`/api/welfare/discipline/${i.id}/notify`} success="Guardian asked to contact the school." onDone={reload} variant="secondary" label="Tell parent" />
                                ) : null}
                            </>
                        )}
                    />
                ),
            }]}
        />
    );
}
