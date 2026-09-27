"use client";

import React from 'react';
import { CalendarOff, Plane } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { date, humanize, personName, today } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';
import { LEAVE_TYPES, type LeaveStatus } from '@/lib/ops/resources/operations';

interface Leave { id: string; staff_id: string; leave_type: string; starts_on: string; ends_on: string; reason: string | null; cover_notes: string | null; status: LeaveStatus; staff: PersonName | null; decider: PersonName | null }

const TONES: Record<LeaveStatus, PillTone> = { PENDING: 'warn', APPROVED: 'good', REJECTED: 'bad', CANCELLED: 'neutral' };

const FIELDS: readonly FieldDef<FieldName<'leave'>>[] = [
    { name: 'leave_type', label: 'Type', kind: 'enum', values: LEAVE_TYPES, required: true },
    { name: 'starts_on', label: 'First day', kind: 'date', required: true },
    { name: 'ends_on', label: 'Last day', kind: 'date', required: true },
    { name: 'reason', label: 'Reason', kind: 'textarea' },
    { name: 'cover_notes', label: 'Lessons and duties to cover', kind: 'textarea', hint: 'Helps the DOS arrange cover.' },
];

const days = (l: Leave) => Math.round((Date.parse(l.ends_on) - Date.parse(l.starts_on)) / 86_400_000) + 1;

export default function LeavePage() {
    const { can, profile } = useAuth();
    const manage = can('hr.manage');
    const mine = (l: Leave) => l.staff_id === profile?.id;
    return (
        <ModulePage
            module="staff_hr"
            title="Staff leave"
            eyebrow="Operations"
            description="Staff apply for leave; the principal, deputy or HR officer approves it."
            icon={Plane}
            hue="sky"
            tabs={[{
                id: 'leave', label: manage ? 'Leave requests' : 'My leave', icon: CalendarOff, hue: 'sky',
                render: () => (
                    <ResourceManager<'leave', Leave>
                        resource="leave"
                        fields={FIELDS}
                        canCreate={can('hr.request')}
                        canEdit={l => mine(l) && l.status === 'PENDING'}
                        canDelete={l => mine(l) && l.status === 'PENDING'}
                        defaults={{ leave_type: 'ANNUAL', starts_on: today(), ends_on: today() }}
                        addLabel="Apply for leave"
                        searchText={l => `${personName(l.staff)} ${l.leave_type}`}
                        rowActions={(l, reload) => (manage && l.status === 'PENDING' && !mine(l) ? (
                            <>
                                <ActionButton url={`/api/hr/leave/${l.id}/decision`} body={{ decision: 'APPROVED' }} success="Leave approved." onDone={reload}>Approve</ActionButton>
                                <ActionButton url={`/api/hr/leave/${l.id}/decision`} body={{ decision: 'REJECTED' }} success="Leave declined." onDone={reload} variant="destructive">Decline</ActionButton>
                            </>
                        ) : null)}
                        columns={[
                            { key: 'who', header: 'Staff', render: l => <span className="font-medium">{personName(l.staff)}</span> },
                            { key: 'type', header: 'Type', render: l => humanize(l.leave_type) },
                            { key: 'dates', header: 'Dates', render: l => `${date(l.starts_on)} – ${date(l.ends_on)} (${days(l)} d)` },
                            { key: 'by', header: 'Decided by', hideOnMobile: true, render: l => (l.decider ? personName(l.decider) : '—') },
                            { key: 'status', header: 'Status', render: l => <StatusPill status={l.status} tones={TONES} /> },
                        ]}
                    />
                ),
            }]}
        />
    );
}
