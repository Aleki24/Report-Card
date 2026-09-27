"use client";

import React, { useState } from 'react';
import { BarChart3, BedDouble, Gift, Layers, Receipt } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { InvoicingPanel } from '@/components/finance/InvoicingPanel';
import { ResidencePanel } from '@/components/finance/ResidencePanel';
import { VoteHeadReport } from '@/components/finance/VoteHeadReport';
import { useOpsList } from '@/hooks/useOpsList';
import { AWARD_KINDS, STRUCTURE_RESIDENCES } from '@/lib/ops/resources/finance';
import { admissionNo, humanize, money, studentName } from '@/lib/ops/format';
import type { StudentEmbed } from '@/lib/ops/resource';

interface VoteHead { id: string; name: string; code: string | null; priority: number; is_active: boolean }
interface StructureItem { id: string; vote_head_id: string; annual_amount: number; vote_head: { name: string } | null }
interface Structure {
    id: string; name: string; residence: string; term_split: number[]; notes: string | null;
    year: { name: string } | null; grade: { name_display: string } | null;
    items: StructureItem[];
}
interface Award { id: string; kind: string; sponsor: string | null; amount: number; reference: string | null; term: { name: string } | null; student: StudentEmbed | null }

const VOTE_HEAD_FIELDS: readonly FieldDef<FieldName<'vote-heads'>>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true, hint: 'e.g. Tuition, Boarding equipment & stores, Activity' },
    { name: 'code', label: 'Code', kind: 'text' },
    { name: 'priority', label: 'Allocation order', kind: 'number', hint: 'Payments fill lower numbers first.' },
    { name: 'is_active', label: 'In use', kind: 'checkbox' },
];

const STRUCTURE_FIELDS: readonly FieldDef<FieldName<'fee-structures'>>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true, span: 'full', hint: 'e.g. Grade 10 boarders 2026' },
    { name: 'academic_year_id', label: 'Academic year', kind: 'lookup', lookup: 'years', required: true },
    { name: 'grade_id', label: 'Class level', kind: 'lookup', lookup: 'grades', hint: 'Leave empty for every class.' },
    { name: 'residence', label: 'Applies to', kind: 'enum', values: STRUCTURE_RESIDENCES, required: true, labels: { ALL: 'Day scholars and boarders', DAY: 'Day scholars', BOARDER: 'Boarders' } },
    { name: 'term_split', label: 'Share per term (%)', kind: 'numberList', placeholder: '50, 30, 20', hint: 'Ministry guideline: 50, 30, 20.' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];

const AWARD_FIELDS: readonly FieldDef<FieldName<'fee-awards'>>[] = [
    { name: 'student_id', label: 'Learner', kind: 'lookup', lookup: 'students', required: true, span: 'full' },
    { name: 'term_id', label: 'Term', kind: 'lookup', lookup: 'terms', required: true },
    { name: 'kind', label: 'Kind', kind: 'enum', values: AWARD_KINDS, required: true },
    { name: 'amount', label: 'Amount (KES)', kind: 'number', required: true },
    { name: 'sponsor', label: 'Sponsor', kind: 'text', hint: 'CDF, county, church, company…' },
    { name: 'reference', label: 'Reference', kind: 'text' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
];

/** The vote heads of one structure, with annual amounts. */
function StructureItems({ structure, canManage }: { structure: Structure; canManage: boolean }) {
    const voteHeads = useOpsList<VoteHead>('vote-heads');
    const fields: readonly FieldDef<FieldName<'fee-structure-items'>>[] = [
        { name: 'vote_head_id', label: 'Vote head', kind: 'options', options: voteHeads.rows.filter(v => v.is_active).map(v => ({ id: v.id, label: v.name })), required: true },
        { name: 'annual_amount', label: 'Amount for the year (KES)', kind: 'number', required: true },
    ];
    return (
        <ResourceManager<'fee-structure-items', StructureItem>
            resource="fee-structure-items"
            params={{ structure_id: structure.id }}
            defaults={{ structure_id: structure.id }}
            fields={[{ name: 'structure_id', label: 'Structure', kind: 'hidden' }, ...fields]}
            canCreate={canManage}
            canEdit={canManage}
            canDelete={canManage}
            header={rows => (
                <p className="text-sm text-muted-foreground">
                    Year total {money(rows.reduce((n, r) => n + Number(r.annual_amount), 0))} · split {structure.term_split.join(' / ')}%
                </p>
            )}
            columns={[
                { key: 'vh', header: 'Vote head', render: i => <span className="font-medium">{i.vote_head?.name}</span> },
                { key: 'amount', header: 'Per year', numeric: true, render: i => money(i.annual_amount) },
                ...structure.term_split.map((pct, t) => ({ key: `t${t}`, header: `Term ${t + 1}`, numeric: true, hideOnMobile: true, render: (i: StructureItem) => money(Math.round(Number(i.annual_amount) * pct / 100)) })),
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
                    defaults={{ residence: 'ALL', term_split: '50, 30, 20' }}
                    onRowClick={setOpen}
                    columns={[
                        { key: 'name', header: 'Structure', render: s => <span className="font-medium">{s.name}</span> },
                        { key: 'who', header: 'For', render: s => `${s.grade?.name_display ?? 'All classes'} · ${humanize(s.residence)}` },
                        { key: 'year', header: 'Year', hideOnMobile: true, render: s => s.year?.name },
                        { key: 'total', header: 'Per year', numeric: true, render: s => money(s.items.reduce((n, i) => n + Number(i.annual_amount), 0)) },
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
                    defaults={{ priority: '100', is_active: true }}
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
                            defaults={{ kind: 'BURSARY' }}
                            searchText={a => `${studentName(a.student)} ${admissionNo(a.student)} ${a.sponsor ?? ''}`}
                            header={() => <p className="text-sm text-muted-foreground">Awards reduce what a learner owes when the term is billed (bill again after adding one).</p>}
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
