"use client";

import React from 'react';
import { CalendarOff, Plane } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import { date, humanize, personName } from '@/lib/ops/format';
import { LEAVE_FIELDS, LEAVE_TONES, leaveDays, leaveDefaults, type Leave } from '@/lib/ops/forms/operations';

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
                        fields={LEAVE_FIELDS}
                        canCreate={can('hr.request')}
                        canEdit={l => mine(l) && l.status === 'PENDING'}
                        canDelete={l => mine(l) && l.status === 'PENDING'}
                        defaults={leaveDefaults()}
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
                            { key: 'dates', header: 'Dates', render: l => `${date(l.starts_on)} – ${date(l.ends_on)} (${leaveDays(l)} d)` },
                            { key: 'by', header: 'Decided by', hideOnMobile: true, render: l => (l.decider ? personName(l.decider) : '—') },
                            { key: 'status', header: 'Status', render: l => <StatusPill status={l.status} tones={LEAVE_TONES} /> },
                        ]}
                    />
                ),
            }]}
        />
    );
}
