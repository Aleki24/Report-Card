"use client";

import React, { useState } from 'react';
import { BarChart3, BedDouble, Gift, Layers, Receipt } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { InvoicingPanel } from '@/components/finance/InvoicingPanel';
import { ResidencePanel } from '@/components/finance/ResidencePanel';
import { VoteHeadReport } from '@/components/finance/VoteHeadReport';
import { useOpsList } from '@/hooks/useOpsList';
import { admissionNo, humanize, money, studentName } from '@/lib/ops/format';
import {
    AWARDS_NOTE, AWARD_DEFAULTS, AWARD_FIELDS, STRUCTURE_DEFAULTS, STRUCTURE_FIELDS, VOTE_HEAD_DEFAULTS, VOTE_HEAD_FIELDS,
    structureItemFields, structureTotal, termShare, type Award, type Structure, type StructureItem, type VoteHead,
} from '@/lib/ops/forms/finance';

/** The vote heads of one structure, with annual amounts. */
function StructureItems({ structure, canManage }: { structure: Structure; canManage: boolean }) {
    const voteHeads = useOpsList<VoteHead>('vote-heads');
    return (
        <ResourceManager<'fee-structure-items', StructureItem>
            resource="fee-structure-items"
            params={{ structure_id: structure.id }}
            defaults={{ structure_id: structure.id }}
            fields={structureItemFields(voteHeads.rows)}
            canCreate={canManage}
            canEdit={canManage}
            canDelete={canManage}
            header={rows => (
                <p className="text-sm text-muted-foreground">
                    Year total {money(structureTotal(rows))} · split {structure.term_split.join(' / ')}%
                </p>
            )}
            columns={[
                { key: 'vh', header: 'Vote head', render: i => <span className="font-medium">{i.vote_head?.name}</span> },
                { key: 'amount', header: 'Per year', numeric: true, render: i => money(i.annual_amount) },
                ...structure.term_split.map((pct, t) => ({ key: `t${t}`, header: `Term ${t + 1}`, numeric: true, hideOnMobile: true, render: (i: StructureItem) => money(termShare(i.annual_amount, pct)) })),
            ]}
            emptyText="Add the vote heads this structure charges."
        />
    );
}

function Structures({ canManage }: { canManage: boolean }) {
    const [open, setOpen] = useState<Structure | null>(null);
    return (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[2fr_1fr]">
            <section>
                <h2 className="mb-3 text-base font-semibold">Fee structures</h2>
                <ResourceManager<'fee-structures', Structure>
                    resource="fee-structures"
                    fields={STRUCTURE_FIELDS}
                    canCreate={canManage}
                    canEdit={canManage}
                    canDelete={canManage}
                    defaults={STRUCTURE_DEFAULTS}
                    onRowClick={setOpen}
                    columns={[
                        { key: 'name', header: 'Structure', render: s => <span className="font-medium">{s.name}</span> },
                        { key: 'who', header: 'For', render: s => `${s.grade?.name_display ?? 'All classes'} · ${humanize(s.residence)}` },
                        { key: 'year', header: 'Year', hideOnMobile: true, render: s => s.year?.name },
                        { key: 'total', header: 'Per year', numeric: true, render: s => money(structureTotal(s.items)) },
                    ]}
                    emptyText="No fee structures yet. Add vote heads, then a structure per class level and day/boarding."
                />
            </section>
            <section>
                <h2 className="mb-3 text-base font-semibold">Vote heads</h2>
                <ResourceManager<'vote-heads', VoteHead>
                    resource="vote-heads"
                    fields={VOTE_HEAD_FIELDS}
                    canCreate={canManage}
                    canEdit={canManage}
                    canDelete={canManage}
                    defaults={VOTE_HEAD_DEFAULTS}
                    columns={[
                        { key: 'name', header: 'Vote head', render: v => <span className={v.is_active ? 'font-medium' : 'text-muted-foreground line-through'}>{v.name}</span> },
                        { key: 'priority', header: 'Order', numeric: true, render: v => v.priority },
                    ]}
                />
            </section>
            <Drawer isOpen={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ''} size="lg">
                {open && <StructureItems key={open.id} structure={open} canManage={canManage} />}
            </Drawer>
        </div>
    );
}

export default function BillingPage() {
    const { can } = useAuth();
    const manage = can('billing.manage');
    return (
        <ModulePage
            module="fee_structures"
            title="Billing"
            eyebrow="Finance"
            description="Vote heads and fee structures, termly invoicing, bursaries and the vote-head statement."
            icon={Receipt}
            hue="emerald"
            tabs={[
                { id: 'invoice', label: 'Invoicing', icon: Receipt, hue: 'emerald', render: () => <InvoicingPanel canManage={manage} /> },
                { id: 'structures', label: 'Fee structures', shortLabel: 'Structures', icon: Layers, hue: 'blue', render: () => <Structures canManage={manage} /> },
                {
                    id: 'awards', label: 'Bursaries & waivers', shortLabel: 'Bursaries', icon: Gift, hue: 'violet',
                    render: () => (
                        <ResourceManager<'fee-awards', Award>
                            resource="fee-awards"
                            fields={AWARD_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={AWARD_DEFAULTS}
                            searchText={a => `${studentName(a.student)} ${admissionNo(a.student)} ${a.sponsor ?? ''}`}
                            header={() => <p className="text-sm text-muted-foreground">{AWARDS_NOTE}</p>}
                            columns={[
                                { key: 'student', header: 'Learner', render: a => <span className="font-medium">{studentName(a.student)}</span> },
                                { key: 'kind', header: 'Kind', render: a => humanize(a.kind) },
                                { key: 'sponsor', header: 'Sponsor', hideOnMobile: true, render: a => a.sponsor ?? '—' },
                                { key: 'term', header: 'Term', hideOnMobile: true, render: a => a.term?.name },
                                { key: 'amount', header: 'Amount', numeric: true, render: a => money(a.amount) },
                            ]}
                        />
                    ),
                },
                { id: 'residence', label: 'Day & boarding', shortLabel: 'Residence', icon: BedDouble, hue: 'amber', render: () => <ResidencePanel canEdit={manage} /> },
                { id: 'report', label: 'Vote-head statement', shortLabel: 'Statement', icon: BarChart3, hue: 'teal', render: () => <VoteHeadReport canRemind={can('fees.manage')} /> },
            ]}
        />
    );
}
