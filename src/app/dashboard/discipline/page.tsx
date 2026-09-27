"use client";

import React from 'react';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { admissionNo, date, humanize, personName, studentName, today } from '@/lib/ops/format';
import type { PersonName, StudentEmbed } from '@/lib/ops/resource';
import { INCIDENT_ACTIONS, INCIDENT_CATEGORIES, INCIDENT_SEVERITIES, INCIDENT_STATUSES } from '@/lib/ops/resources/welfare';

interface Incident {
    id: string; occurred_on: string; category: string; severity: (typeof INCIDENT_SEVERITIES)[number]; description: string;
    action_taken: string; status: (typeof INCIDENT_STATUSES)[number]; parent_notified: boolean; reported_by: string | null;
    student: StudentEmbed | null; reporter: PersonName | null;
}

const SEVERITY_TONES: Record<Incident['severity'], PillTone> = { MINOR: 'neutral', MAJOR: 'warn', CRITICAL: 'bad' };
const STATUS_TONES: Record<Incident['status'], PillTone> = { OPEN: 'warn', RESOLVED: 'good' };

const REPORT_FIELDS: readonly FieldDef<FieldName<'discipline'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'occurred_on', label: 'Date', kind: 'date', required: true },
    { name: 'category', label: 'Category', kind: 'enum', values: INCIDENT_CATEGORIES, required: true },
    { name: 'severity', label: 'Severity', kind: 'enum', values: INCIDENT_SEVERITIES, required: true },
    { name: 'description', label: 'What happened', kind: 'textarea', required: true },
];
const MANAGE_FIELDS: readonly FieldDef<FieldName<'discipline'>>[] = [
    ...REPORT_FIELDS,
    { name: 'action_taken', label: 'Action taken', kind: 'enum', values: INCIDENT_ACTIONS, required: true },
    { name: 'status', label: 'Status', kind: 'enum', values: INCIDENT_STATUSES, required: true },
];

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
                        fields={manage ? MANAGE_FIELDS : REPORT_FIELDS}
                        canCreate={record}
                        canEdit={i => manage || (mine(i) && i.status === 'OPEN')}
                        canDelete={i => manage || (mine(i) && i.status === 'OPEN')}
                        defaults={{ occurred_on: today(), severity: 'MINOR', action_taken: 'NONE', status: 'OPEN' }}
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
                            { key: 'status', header: 'Status', render: i => <StatusPill status={i.status} tones={STATUS_TONES} /> },
                        ]}
                    />
                ),
            }]}
        />
    );
}
