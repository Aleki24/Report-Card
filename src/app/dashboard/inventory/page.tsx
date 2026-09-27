"use client";

import React from 'react';
import { AlertTriangle, ClipboardList, Package } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill, type PillTone } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import type { FieldDef, FieldName } from '@/components/ops/fields';
import { useOpsList } from '@/hooks/useOpsList';
import { dateTime, humanize, money, personName } from '@/lib/ops/format';
import type { PersonName } from '@/lib/ops/resource';
import { ITEM_TYPES, type RequisitionStatus } from '@/lib/ops/resources/operations';

interface Item { id: string; name: string; item_type: string; category: string | null; unit: string; quantity: number; reorder_level: number; location: string | null; unit_value: number | null }
interface Requisition { id: string; quantity: number; purpose: string | null; status: RequisitionStatus; created_at: string; requested_by: string | null; item: { name: string; unit: string; quantity: number } | null; requester: PersonName | null }

const REQ_TONES: Record<RequisitionStatus, PillTone> = { PENDING: 'warn', APPROVED: 'info', REJECTED: 'bad', ISSUED: 'good' };

const ITEM_FIELDS: readonly FieldDef<FieldName<'inventory'>>[] = [
    { name: 'name', label: 'Item', kind: 'text', required: true, span: 'full' },
    { name: 'item_type', label: 'Type', kind: 'enum', values: ITEM_TYPES, required: true, labels: { ASSET: 'Asset (furniture, equipment)', CONSUMABLE: 'Consumable (food, stationery)' } },
    { name: 'category', label: 'Category', kind: 'text' },
    { name: 'unit', label: 'Unit', kind: 'text', required: true, placeholder: 'pcs, kg, bags, reams' },
    { name: 'quantity', label: 'Quantity', kind: 'number', required: true },
    { name: 'reorder_level', label: 'Reorder at', kind: 'number' },
    { name: 'location', label: 'Location', kind: 'text' },
    { name: 'serial_number', label: 'Serial / tag', kind: 'text' },
    { name: 'unit_value', label: 'Unit value (KES)', kind: 'number' },
];

function Requisitions({ manage }: { manage: boolean }) {
    const { profile } = useAuth();
    const items = useOpsList<Item>('inventory');
    const fields: readonly FieldDef<FieldName<'requisitions'>>[] = [
        { name: 'item_id', label: 'Item', kind: 'options', options: items.rows.map(i => ({ id: i.id, label: i.name, hint: `${i.quantity} ${i.unit} in store` })), required: true, span: 'full' },
        { name: 'quantity', label: 'Quantity', kind: 'number', required: true },
        { name: 'purpose', label: 'For', kind: 'textarea' },
    ];
    const mine = (r: Requisition) => r.requested_by === profile?.id;
    return (
        <ResourceManager<'requisitions', Requisition>
            resource="requisitions"
            fields={fields}
            canCreate
            canEdit={r => mine(r) && r.status === 'PENDING'}
            canDelete={r => mine(r) && r.status === 'PENDING'}
            addLabel="Request from store"
            rowActions={(r, reload) => (manage ? (
                <>
                    {r.status === 'PENDING' && <ActionButton url={`/api/inventory/requisitions/${r.id}/decision`} body={{ decision: 'APPROVE' }} success="Approved." onDone={reload}>Approve</ActionButton>}
                    {r.status === 'PENDING' && <ActionButton url={`/api/inventory/requisitions/${r.id}/decision`} body={{ decision: 'REJECT' }} success="Rejected." onDone={reload} variant="destructive">Reject</ActionButton>}
                    {r.status === 'APPROVED' && <ActionButton url={`/api/inventory/requisitions/${r.id}/decision`} body={{ decision: 'ISSUE' }} success="Issued and taken off stock." onDone={reload} variant="outline">Issue</ActionButton>}
                </>
            ) : null)}
            columns={[
                { key: 'item', header: 'Item', render: r => <span className="font-medium">{r.item?.name}</span> },
                { key: 'qty', header: 'Quantity', numeric: true, render: r => `${r.quantity} ${r.item?.unit ?? ''}` },
                { key: 'by', header: 'Requested by', hideOnMobile: true, render: r => personName(r.requester) },
                { key: 'when', header: 'When', hideOnMobile: true, render: r => dateTime(r.created_at) },
                { key: 'status', header: 'Status', render: r => <StatusPill status={r.status} tones={REQ_TONES} /> },
            ]}
        />
    );
}

export default function InventoryPage() {
    const { can } = useAuth();
    const manage = can('inventory.manage');
    return (
        <ModulePage
            module="inventory"
            title="Inventory & stores"
            eyebrow="Operations"
            description="The asset register and store stock, with requisitions that are approved, issued and taken off stock."
            icon={Package}
            hue="orange"
            tabs={[
                {
                    id: 'stock', label: 'Stock & assets', shortLabel: 'Stock', icon: Package, hue: 'orange',
                    render: () => (
                        <ResourceManager<'inventory', Item>
                            resource="inventory"
                            fields={ITEM_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={{ item_type: 'CONSUMABLE', unit: 'pcs', reorder_level: '0' }}
                            searchText={i => `${i.name} ${i.category ?? ''} ${i.location ?? ''}`}
                            header={rows => {
                                const low = rows.filter(r => r.item_type === 'CONSUMABLE' && Number(r.quantity) <= Number(r.reorder_level)).length;
                                const value = rows.reduce((n, r) => n + Number(r.quantity) * Number(r.unit_value ?? 0), 0);
                                return (
                                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                        <StatTile icon={AlertTriangle} label="To reorder" value={low} tone={low > 0 ? 'warn' : 'good'} />
                                        <StatTile icon={Package} label="Value on record" value={money(value)} hue="orange" />
                                    </div>
                                );
                            }}
                            columns={[
                                { key: 'name', header: 'Item', render: i => <span className="font-medium">{i.name}</span> },
                                { key: 'type', header: 'Type', hideOnMobile: true, render: i => humanize(i.item_type) },
                                { key: 'qty', header: 'Quantity', numeric: true, render: i => <span className={i.item_type === 'CONSUMABLE' && Number(i.quantity) <= Number(i.reorder_level) ? 'font-semibold text-amber-600' : ''}>{Number(i.quantity)} {i.unit}</span> },
                                { key: 'loc', header: 'Location', hideOnMobile: true, render: i => i.location ?? '—' },
                            ]}
                        />
                    ),
                },
                { id: 'requisitions', label: 'Requisitions', icon: ClipboardList, hue: 'blue', visible: can('inventory.request') || manage, render: () => <Requisitions manage={manage} /> },
            ]}
        />
    );
}
