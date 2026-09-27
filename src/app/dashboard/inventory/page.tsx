"use client";

import React from 'react';
import { AlertTriangle, ClipboardList, Package } from 'lucide-react';
import { StatTile } from '@/components/ui/StatTile';
import { useAuth } from '@/components/AuthProvider';
import { ModulePage } from '@/components/ops/ModulePage';
import { ResourceManager } from '@/components/ops/ResourceManager';
import { StatusPill } from '@/components/ops/StatusPill';
import { ActionButton } from '@/components/ops/ActionButton';
import { useOpsList } from '@/hooks/useOpsList';
import { dateTime, humanize, money, personName } from '@/lib/ops/format';
import {
    ITEM_DEFAULTS, ITEM_FIELDS, REQUISITION_TONES, needsReorder, requisitionDecisions, requisitionFields, stockValue,
    type Item, type Requisition,
} from '@/lib/ops/forms/operations';

function Requisitions({ manage }: { manage: boolean }) {
    const { profile } = useAuth();
    const items = useOpsList<Item>('inventory');
    const fields = requisitionFields(items.rows);
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
                    {requisitionDecisions(r.status).map(d => (
                        <ActionButton key={d.decision} url={`/api/inventory/requisitions/${r.id}/decision`} body={{ decision: d.decision }} success={d.success} onDone={reload}
                            variant={d.decision === 'REJECT' ? 'destructive' : d.decision === 'ISSUE' ? 'outline' : 'default'}>{d.label}</ActionButton>
                    ))}
                </>
            ) : null)}
            columns={[
                { key: 'item', header: 'Item', render: r => <span className="font-medium">{r.item?.name}</span> },
                { key: 'qty', header: 'Quantity', numeric: true, render: r => `${r.quantity} ${r.item?.unit ?? ''}` },
                { key: 'by', header: 'Requested by', hideOnMobile: true, render: r => personName(r.requester) },
                { key: 'when', header: 'When', hideOnMobile: true, render: r => dateTime(r.created_at) },
                { key: 'status', header: 'Status', render: r => <StatusPill status={r.status} tones={REQUISITION_TONES} /> },
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
                            defaults={ITEM_DEFAULTS}
                            searchText={i => `${i.name} ${i.category ?? ''} ${i.location ?? ''}`}
                            header={rows => {
                                const low = rows.filter(needsReorder).length;
                                const value = stockValue(rows);
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
                                { key: 'qty', header: 'Quantity', numeric: true, render: i => <span className={needsReorder(i) ? 'font-semibold text-amber-600' : ''}>{Number(i.quantity)} {i.unit}</span> },
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
