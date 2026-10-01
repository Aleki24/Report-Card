import React from 'react';
import { date, humanize, personName } from '@shared/ops/format';
import { LEAVE_FIELDS, LEAVE_TONES, leaveDays, leaveDefaults, type Leave } from '@shared/ops/forms/operations';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { ActionButton, StatusPill } from '@/components/ops/bits';
import { useCurrentUser } from '@/lib/UserContext';

export default function LeaveScreen() {
    const { can, profile } = useCurrentUser();
    const manage = can('hr.manage');
    const mine = (l: Leave) => l.staff_id === profile?.id;
    return (
        <ModuleScreen
            screen="leave"
            title="Staff leave"
            description="Staff apply for leave; the principal, deputy or HR officer approves it."
            tabs={[{
                id: 'leave',
                label: manage ? 'Leave requests' : 'My leave',
                render: () => (
                    <ResourceList<'leave', Leave>
                        resource="leave"
                        fields={LEAVE_FIELDS}
                        canCreate={can('hr.request')}
                        canEdit={(l) => mine(l) && l.status === 'PENDING'}
                        canDelete={(l) => mine(l) && l.status === 'PENDING'}
                        defaults={leaveDefaults()}
                        addLabel="Apply for leave"
                        searchText={(l) => `${personName(l.staff)} ${l.leave_type}`}
                        title={(l) => personName(l.staff)}
                        subtitle={(l) => `${humanize(l.leave_type)} · ${date(l.starts_on)} – ${date(l.ends_on)} (${leaveDays(l)} d)`}
                        badge={(l) => <StatusPill status={l.status} tones={LEAVE_TONES} />}
                        details={(l) => [
                            ['Reason', l.reason ?? '—'],
                            ['Cover', l.cover_notes ?? '—'],
                            ['Decided by', l.decider ? personName(l.decider) : '—'],
                        ]}
                        rowActions={(l, reload) => (manage && l.status === 'PENDING' && !mine(l) ? (
                            <>
                                <ActionButton path={`/api/hr/leave/${l.id}/decision`} body={{ decision: 'APPROVED' }} success="Leave approved." onDone={reload} label="Approve" />
                                <ActionButton path={`/api/hr/leave/${l.id}/decision`} body={{ decision: 'REJECTED' }} success="Leave declined." onDone={reload} variant="danger" label="Decline" />
                            </>
                        ) : null)}
                    />
                ),
            }]}
        />
    );
}
