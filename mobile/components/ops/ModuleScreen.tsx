import React, { useMemo, useState } from 'react';
import { ChipSelect, EmptyState, Screen, ScreenHeader, SegmentedTabs } from '@/components/ui';
import { RequireScreen } from '@/components/RequireScreen';
import type { StaffScreen } from '@/lib/roles';
import { RefreshSignalProvider } from './bits';

export interface ModuleTab<Id extends string> {
    id: Id;
    label: string;
    /** Hidden when false (the viewer lacks the permission it needs). */
    visible?: boolean;
    render: () => React.ReactNode;
}

/**
 * The frame every module screen shares — the phone version of the web's
 * `ModulePage`: access check (role, duty, module), header, the tabs this
 * viewer may use, and pull-to-refresh that reloads every list inside.
 */
export function ModuleScreen<Id extends string>({ screen, title, description, tabs, action }: {
    screen: StaffScreen;
    title: string;
    description: string;
    tabs: readonly ModuleTab<Id>[];
    action?: React.ReactNode;
}) {
    return (
        <RequireScreen screen={screen}>
            <ModuleBody title={title} description={description} tabs={tabs} action={action} />
        </RequireScreen>
    );
}

function ModuleBody<Id extends string>({ title, description, tabs, action }: { title: string; description: string; tabs: readonly ModuleTab<Id>[]; action?: React.ReactNode }) {
    const visible = useMemo(() => tabs.filter((t) => t.visible !== false), [tabs]);
    const [active, setActive] = useState<Id | null>(null);
    const [signal, setSignal] = useState(0);
    const current = visible.find((t) => t.id === active) ?? visible[0];
    const options = visible.map((t) => ({ value: t.id, label: t.label }));

    return (
        <Screen onRefresh={() => setSignal((n) => n + 1)} refreshing={false}>
            <ScreenHeader title={title} description={description} action={action} />
            {!current ? (
                <EmptyState title="Nothing here for your account" description="Ask your administrator to give you the duty that covers this area." />
            ) : (
                <>
                    {visible.length > 1 && visible.length <= 3 ? <SegmentedTabs tabs={options} value={current.id} onChange={setActive} /> : null}
                    {visible.length > 3 ? <ChipSelect options={options} value={current.id} onChange={setActive} /> : null}
                    <RefreshSignalProvider value={signal}>
                        <React.Fragment key={current.id}>{current.render()}</React.Fragment>
                    </RefreshSignalProvider>
                </>
            )}
        </Screen>
    );
}
