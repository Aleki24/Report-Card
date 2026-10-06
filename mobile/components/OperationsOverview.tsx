import React from 'react';
import { View } from 'react-native';
import { LayoutGrid } from 'lucide-react-native';
import type { OverviewTile } from '@shared/ops/overview';
import { useOpsData } from '@/lib/ops';
import { hueForHref } from '@/lib/hues';
import { screenIconFor } from '@/lib/roles';
import { KpiGrid, KpiTile, SectionTitle, appHref } from './dashboard/kit';

/**
 * One "At a glance" grid: the home's own figures (learners, pass rate, marks
 * to enter…) followed by the live figures of every module the school runs
 * that the viewer may see — the web's "Key figures" and "Across the school"
 * in one place, every tile in the same style. Renders nothing when empty.
 */
export function OperationsOverview({ title = 'At a glance', children }: { title?: string; children?: React.ReactNode }) {
    const { data } = useOpsData<OverviewTile[]>('/api/ops/overview');
    const tiles = data ?? [];
    const own = React.Children.toArray(children).filter(Boolean);
    if (tiles.length === 0 && own.length === 0) return null;
    return (
        <View accessibilityLabel={title}>
            <SectionTitle title={title} />
            <KpiGrid>
                {own}
                {tiles.map((t) => {
                    const href = appHref(t.href);
                    const path = String(href).split('?')[0];
                    return (
                        <KpiTile
                            key={t.key}
                            title={t.hint ? `${t.label} · ${t.hint}` : t.label}
                            value={t.value}
                            icon={screenIconFor(path) ?? LayoutGrid}
                            hue={hueForHref(t.href)}
                            tone={t.tone === 'default' ? undefined : t.tone}
                            href={href}
                        />
                    );
                })}
            </KpiGrid>
        </View>
    );
}
