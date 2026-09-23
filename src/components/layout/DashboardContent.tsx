"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuth } from '@/components/AuthProvider';
import { Wordmark } from '@/components/Wordmark';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { canAccessPath } from '@/components/layout/sidebar/navItems';
import { homePathForRole } from '@/lib/roles';

const COLLAPSE_KEY = 'sidebar-collapsed';

export default function DashboardContent({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsedState] = useState(true);
    const { schoolName, profile, role, schoolOnboardingCompleted, loading } = useAuth();

    useEffect(() => {
        // localStorage is client-only, so the persisted value can't seed
        // useState without a hydration mismatch; one post-mount sync is fine.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsedState(localStorage.getItem(COLLAPSE_KEY) !== 'false');
    }, []);

    const setCollapsed = (val: boolean) => {
        setCollapsedState(val);
        localStorage.setItem(COLLAPSE_KEY, String(val));
    };

    const sidebarWidth = collapsed ? 80 : 260;

    const needsSchoolSetup = role === 'PENDING' || (role === 'ADMIN' && profile && schoolOnboardingCompleted === false);

    // Pages are only ever linked for the roles that can use them, but a typed
    // URL, bookmark or stale link could still open, say, Fees as a student and
    // show a page whose every request is refused. Send such visits home.
    const isForbiddenPath = !loading && !!role && !needsSchoolSetup && !canAccessPath(pathname, role);

    React.useEffect(() => {
        if (!loading && needsSchoolSetup && pathname !== '/dashboard/onboarding') {
            router.push('/dashboard/onboarding');
        } else if (isForbiddenPath) {
            router.replace(homePathForRole(role));
        }
    }, [loading, needsSchoolSetup, isForbiddenPath, pathname, role, router]);

    // Don't render sidebar and header if on onboarding page
    if (pathname === '/dashboard/onboarding') {
        return <main>{children}</main>;
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Mobile Top Bar */}
            <div className="mobile-topbar-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Image src="/images/logo.png" alt="Skulbase Logo" width={32} height={32}
                      style={{ borderRadius: 'var(--radius-md)', objectFit: 'contain' }}
                    />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{schoolName || <Wordmark />}</span>
                </div>
            </div>

            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

            <main className="dashboard-main" style={{
                '--sidebar-width': `${sidebarWidth}px`,
                display: 'flex', flexDirection: 'column',
            } as React.CSSProperties}>
                {isForbiddenPath ? <ContentSkeleton /> : children}
            </main>
        </div>
    );
}
