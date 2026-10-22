"use client";

import dynamic from 'next/dynamic';

/*
 * The charts, with recharts fetched only when a chart is on screen: the page
 * shows first, and a placeholder holds the chart's space so nothing jumps
 * when it arrives. Import charts from here, not from their own files.
 */

export const PerformanceTrendChart = dynamic(
    () => import('./PerformanceTrend').then(m => m.PerformanceTrendChart),
    { ssr: false, loading: () => <div className="skeleton-bone h-60 w-full rounded-xl" aria-hidden /> },
);

export const GradeDistributionChart = dynamic(
    () => import('./GradeDistribution').then(m => m.GradeDistributionChart),
    { ssr: false, loading: () => <div className="skeleton-bone h-[440px] w-full rounded-xl" aria-hidden /> },
);
