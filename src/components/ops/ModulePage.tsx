"use client";

import React, { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { Lock, PackageX, type LucideIcon } from 'lucide-react';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { PageTabs, useUrlTab, type PageTab } from '@/components/ui/PageTabs';
import type { Hue } from '@/components/ui/tones';
import { useAuth } from '@/components/AuthProvider';
import { MODULES, type ModuleKey } from '@/lib/platform/modules';

export interface ModuleTab<Id extends string> extends PageTab<Id> {
    /** Hidden when false (the viewer lacks the permission it needs). */
    visible?: boolean;
    render: () => React.ReactNode;
}

interface ModulePageProps<Id extends string> {
    module: ModuleKey;
    title: string;
    description: string;
    eyebrow: string;
    icon: LucideIcon;
    hue: Hue;
    tabs: readonly ModuleTab<Id>[];
    action?: React.ReactNode;
}

/**
 * The frame every module page shares: its header, the tabs this viewer may
 * use (kept in `?tab=`), and a clear message instead of a broken page when
 * the module is off or nothing in it is theirs.
 */
export function ModulePage<Id extends string>(props: ModulePageProps<Id>) {
    return (
        <Suspense fallback={<ContentSkeleton message="Loading…" />}>
            <ModulePageInner {...props} />
        </Suspense>
    );
}

function ModulePageInner<Id extends string>({ module, title, description, eyebrow, icon, hue, tabs, action }: ModulePageProps<Id>) {
    const { hasModule, role, loading } = useAuth();
    const visible = useMemo(() => tabs.filter(t => t.visible !== false), [tabs]);
    const [active, select] = useUrlTab(visible);
    const idPrefix = `mod-${module}`;

    if (loading) return <ContentSkeleton message="Loading…" />;

    const header = <PageHeader title={title} description={description} eyebrow={eyebrow} icon={icon} hue={hue} action={action} />;

    if (!hasModule(module)) {
        return (
            <div className="mx-auto w-full max-w-7xl">
                {header}
                <EmptyState
                    hue={hue}
                    icon={<PackageX className="size-6" />}
                    title={`${MODULES[module].name} is switched off`}
                    description={role === 'ADMIN' ? 'Turn it on under Settings → Modules to start using it.' : 'Ask your school administrator to turn it on.'}
                    action={role === 'ADMIN' ? <Link href="/dashboard/settings?tab=modules" className="btn-primary">Open Settings</Link> : undefined}
                />
            </div>
        );
    }

    if (visible.length === 0) {
        return (
            <div className="mx-auto w-full max-w-7xl">
                {header}
                <EmptyState hue={hue} icon={<Lock className="size-6" />} title="Nothing here for your account" description="Ask your administrator to give you the duty that covers this area." />
            </div>
        );
    }

    const current = visible.find(t => t.id === active) ?? visible[0];

    return (
        <div className="mx-auto w-full max-w-7xl">
            {header}
            {visible.length > 1 && <PageTabs tabs={visible} active={current.id} onSelect={select} label={title} idPrefix={idPrefix} />}
            <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${current.id}`}>
                {current.render()}
            </div>
        </div>
    );
}
