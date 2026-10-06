import React from 'react';
import { HomeScreen } from './Hero';
import { Bell } from 'lucide-react-native';
import type { DashboardData } from '@shared/dashboard';
import { useApiQuery } from '@/lib/useApiQuery';
import { OperationsOverview } from '@/components/OperationsOverview';
import { DashboardHero } from './Hero';
import { InsightCard, LinkRow, Reveal } from './kit';

/**
 * Non-teaching staff (bursar, nurse, matron, driver…): school news, and the
 * figures of whatever duties their menu holds.
 */
export function StaffHome({ name, jobTitle }: { name: string; jobTitle: string | null }) {
    const summary = useApiQuery<DashboardData>('/api/school/dashboard', { raw: true });
    return (
        <HomeScreen onRefresh={summary.refresh} refreshing={summary.refreshing}>
            <Reveal index={0}>
                <DashboardHero
                    name={name}
                    term={summary.data?.term ?? null}
                    canEditTerms={false}
                    eyebrow={jobTitle || 'Staff'}
                    summary="Keep up with school news here. Your duties add their pages to your menu."
                />
            </Reveal>
            <Reveal index={1}><OperationsOverview /></Reveal>
            <Reveal index={2} style={{ marginTop: 20 }}>
                <InsightCard title="School news">
                    <LinkRow label="Announcements" desc="Read the latest notices from the school" icon={Bell} hue="rose" href="/staff/announcements" last />
                </InsightCard>
            </Reveal>
        </HomeScreen>
    );
}
