import { useTheme } from '@/lib/theme';
import React from 'react';
import { dateTime, humanize, money, personName } from '@shared/ops/format';
import {
    ITEM_DEFAULTS, ITEM_FIELDS, REQUISITION_TONES, needsReorder, requisitionDecisions, requisitionFields, stockValue,
    type Item, type Requisition,
} from '@shared/ops/forms/operations';
import { StatGrid, StatTile } from '@/components/ui';
import { ModuleScreen } from '@/components/ops/ModuleScreen';
import { ResourceList } from '@/components/ops/ResourceList';
import { ActionButton, StatusPill, toneColor } from '@/components/ops/bits';
import { useOpsList } from '@/lib/ops';
import { useCurrentUser } from '@/lib/UserContext';

function Requisitions({ manage }: { manage: boolean }) {
    const { profile } = useCurrentUser();
    const items = useOpsList<Item>('inventory');
    const mine = (r: Requisition) => r.requested_by === profile?.id;
    return (
        <ResourceList<'requisitions', Requisition>
            resource="requisitions"
            fields={requisitionFields(items.rows)}
            canCreate
            canEdit={(r) => mine(r) && r.status === 'PENDING'}
            canDelete={(r) => mine(r) && r.status === 'PENDING'}
            addLabel="Request from store"
            title={(r) => r.item?.name ?? 'Item'}
            subtitle={(r) => `${r.quantity} ${r.item?.unit ?? ''}${r.purpose ? ` · ${r.purpose}` : ''}`}
            badge={(r) => <StatusPill status={r.status} tones={REQUISITION_TONES} />}
            details={(r) => [
                ['Requested by', personName(r.requester)],
                ['When', dateTime(r.created_at)],
            ]}
            rowActions={(r, reload) => (manage ? (
                <>
                    {requisitionDecisions(r.status).map((d) => (
                        <ActionButton
                            key={d.decision}
                            path={`/api/inventory/requisitions/${r.id}/decision`}
                            body={{ decision: d.decision }}
                            success={d.success}
                            onDone={reload}
                            label={d.label}
                            variant={d.decision === 'REJECT' ? 'danger' : d.decision === 'ISSUE' ? 'secondary' : 'primary'}
                        />
                    ))}
                </>
            ) : null)}
        />
    );
}

export default function InventoryScreen() {
    const { colors } = useTheme();
    const { can } = useCurrentUser();
    const manage = can('inventory.manage');
    return (
        <ModuleScreen
            screen="inventory"
            title="Inventory & stores"
            description="The asset register and store stock, with requisitions that are approved, issued and taken off stock."
            tabs={[
                {
                    id: 'stock',
                    label: 'Stock & assets',
                    render: () => (
                        <ResourceList<'inventory', Item>
                            resource="inventory"
                            fields={ITEM_FIELDS}
                            canCreate={manage}
                            canEdit={manage}
                            canDelete={manage}
                            defaults={ITEM_DEFAULTS}
                            searchText={(i) => `${i.name} ${i.category ?? ''} ${i.location ?? ''}`}
                            header={(rows) => {
                                const low = rows.filter(needsReorder).length;
                                return (
                                    <StatGrid>
                                        <StatTile label="To reorder" value={low} tone={toneColor(colors, low > 0 ? 'warn' : 'good')} />
                                        <StatTile label="Value on record" value={money(stockValue(rows))} />
                                    </StatGrid>
                                );
                            }}
                            title={(i) => i.name}
                            subtitle={(i) => humanize(i.item_type)}
                            details={(i) => [
                                ['Quantity', `${Number(i.quantity)} ${i.unit}${needsReorder(i) ? ' · reorder' : ''}`],
                                ['Location', i.location ?? '—'],
                            ]}
                        />
                    ),
                },
                { id: 'requisitions', label: 'Requisitions', visible: can('inventory.request') || manage, render: () => <Requisitions manage={manage} /> },
            ]}
        />
    );
}
