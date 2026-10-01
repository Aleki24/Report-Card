"use client";

import React from 'react';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import { admissionNo, date, humanize, personName, studentName } from '@/lib/ops/format';
import {
    INCIDENT_MANAGE_FIELDS, INCIDENT_REPORT_FIELDS, INCIDENT_STATUS_TONES, SEVERITY_TONES, incidentDefaults, type Incident,
} from '@/lib/ops/forms/welfare';

export default function DisciplinePage() {
    const { can, profile } = useAuth();
    const manage = can('discipline.manage');
    const record = can('discipline.record') || manage;
    const mine = (i: Incident) => i.reported_by === profile?.id;
    return (
        <ModulePage
            module="discipline"
            title="Discipline"
            eyebrow="Welfare"
            description="Teachers report incidents; the discipline master records the action taken and informs parents."
            icon={ShieldAlert}
            hue="rose"
            tabs={[{
                id: 'incidents', label: 'Incidents', icon: ShieldAlert, hue: 'rose',
                render: () => (
                    <ResourceManager<'discipline', Incident>
                        resource="discipline"
                        fields={manage ? INCIDENT_MANAGE_FIELDS : INCIDENT_REPORT_FIELDS}
                        canCreate={record}
                        canEdit={i => manage || (mine(i) && i.status === 'OPEN')}
                        canDelete={i => manage || (mine(i) && i.status === 'OPEN')}
                        defaults={incidentDefaults()}
                        addLabel="Report incident"
                        searchText={i => `${studentName(i.student)} ${admissionNo(i.student)} ${i.category} ${i.description}`}
                        header={() => (!manage ? <p className="text-sm text-muted-foreground">You see the incidents you reported. The discipline master decides the action.</p> : null)}
                        rowActions={(i, reload) => (manage && !i.parent_notified ? (
                            <ActionButton url={`/api/welfare/discipline/${i.id}/notify`} success="Guardian asked to contact the school." onDone={reload} variant="outline"><MessageSquare />Tell parent</ActionButton>
                        ) : null)}
                        columns={[
                            { key: 'learner', header: 'Learner', render: i => <span className="font-medium">{studentName(i.student)}</span> },
                            { key: 'what', header: 'Incident', render: i => humanize(i.category) },
                            { key: 'sev', header: 'Severity', render: i => <StatusPill status={i.severity} tones={SEVERITY_TONES} /> },
                            { key: 'action', header: 'Action', hideOnMobile: true, render: i => humanize(i.action_taken) },
                            { key: 'date', header: 'Date', hideOnMobile: true, render: i => date(i.occurred_on) },
                            { key: 'by', header: 'Reported by', hideOnMobile: true, render: i => personName(i.reporter) },
                            { key: 'status', header: 'Status', render: i => <StatusPill status={i.status} tones={INCIDENT_STATUS_TONES} /> },
                        ]}
                    />
                ),
            }]}
        />
    );
}
