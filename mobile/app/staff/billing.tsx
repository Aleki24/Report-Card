import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { admissionNo, humanize, money, studentName } from '@shared/ops/format';
import {
    AWARDS_NOTE, AWARD_DEFAULTS, AWARD_FIELDS, STRUCTURE_DEFAULTS, STRUCTURE_FIELDS, VOTE_HEAD_DEFAULTS, VOTE_HEAD_FIELDS,
    structureItemFields, structureTotal, termShare, type Award, type Structure, type StructureItem, type VoteHead,
} from '@shared/ops/forms/finance';
import { SectionLabel } from '@/components/ui';
import { FormSheet } from '@/components/ops/FormSheet';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { Invoicing, ResidencePanel, VoteHeadStatementPanel } from '@/components/finance/BillingPanels';
import { useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';
import { colors, spacing } from '@/lib/theme';

/** The vote heads of one structure, with annual amounts and each term's share. */
function StructureItems({ structure, manage }: { structure: Structure; manage: boolean }) {
    const voteHeads = useOpsList<VoteHead>('vote-heads');
    return (
        <ResourceList<'fee-structure-items', StructureItem>
            resource="fee-structure-items"
            params={{ structure_id: structure.id }}
            defaults={{ structure_id: structure.id }}
            fields={structureItemFields(voteHeads.rows)}
            canCreate={manage}
            canEdit={manage}
            canDelete={manage}
            header={(rows) => (
                <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>
                    Year total {money(structureTotal(rows))} · split {structure.term_split.join(' / ')}%
                </Text>
            )}
            title={(i) => i.vote_head?.name ?? 'Vote head'}
            subtitle={(i) => `${money(i.annual_amount)} per year`}
            details={(i) => structure.term_split.map((pct, t) => [`Term ${t + 1}`, money(termShare(i.annual_amount, pct))] as const)}
            emptyText="Add the vote heads this structure charges."
        />
    );
}

function Structures({ manage }: { manage: boolean }) {
    const [open, setOpen] = useState<Structure | null>(null);
    return (
        <View>
            <SectionLabel>Fee structures</SectionLabel>
            <ResourceList<'fee-structures', Structure>
                resource="fee-structures"
                fields={STRUCTURE_FIELDS}
                canCreate={manage}
                canEdit={manage}
                canDelete={manage}
                defaults={STRUCTURE_DEFAULTS}
                onRowPress={setOpen}
                title={(s) => s.name}
                subtitle={(s) => `${s.grade?.name_display ?? 'All classes'} · ${humanize(s.residence)}`}
                details={(s) => [
                    ['Year', s.year?.name ?? '—'],
                    ['Per year', money(structureTotal(s.items))],
                ]}
                emptyText="No fee structures yet. Add vote heads, then a structure per class level and day/boarding."
            />
            <SectionLabel>Vote heads</SectionLabel>
            <ResourceList<'vote-heads', VoteHead>
                resource="vote-heads"
                fields={VOTE_HEAD_FIELDS}
                canCreate={manage}
                canEdit={manage}
                canDelete={manage}
                defaults={VOTE_HEAD_DEFAULTS}
                title={(v) => (v.is_active ? v.name : `${v.name} (not in use)`)}
                subtitle={(v) => `Allocation order ${v.priority}${v.code ? ` · ${v.code}` : ''}`}
            />
            <FormSheet visible={open !== null} title={open?.name ?? ''} onClose={() => setOpen(null)}>
                {open ? <StructureItems key={open.id} structure={open} manage={manage} /> : null}
            </FormSheet>
        </View>
    );
}

export default function BillingScreen() {
    const { can } = useCurrentUser();
    const manage = can('billing.manage');
    return (
        <ModuleScreen
            screen="billing"
            title="Billing"
            description="Vote heads and fee structures, termly invoicing, bursaries and the vote-head statement."
            tabs={[
                { id: 'invoice', label: 'Invoicing', render: () => <Invoicing canManage={manage} /> },
                { id: 'structures', label: 'Structures', render: () => <Structures manage={manage} /> },
                {
                    id: 'awards',
                    label: 'Bursaries',
                    render: () => (
                        <ResourceList<'fee-awards', Award>
                            resource="fee-awards"
                            fields={AWARD_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={AWARD_DEFAULTS}
                            searchText={(a) => `${studentName(a.student)} ${admissionNo(a.student)} ${a.sponsor ?? ''}`}
                            header={() => <Text style={{ fontSize: 13, color: colors.muted, marginBottom: spacing.md }}>{AWARDS_NOTE}</Text>}
                            title={(a) => studentName(a.student)}
                            subtitle={(a) => `${humanize(a.kind)} · ${money(a.amount)}`}
                            details={(a) => [
                                ['Sponsor', a.sponsor ?? '—'],
                                ['Term', a.term?.name ?? '—'],
                                ['Reference', a.reference ?? '—'],
                            ]}
                        />
                    ),
                },
                { id: 'residence', label: 'Day & boarding', render: () => <ResidencePanel canEdit={manage} /> },
                { id: 'report', label: 'Statement', render: () => <VoteHeadStatementPanel canRemind={can('fees.manage')} /> },
            ]}
        />
    );
}
