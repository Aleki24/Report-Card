"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuth } from '@/components/AuthProvider';

export default function DashboardContent({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(true);
    const { schoolName, profile, role, schoolOnboardingCompleted, loading } = useAuth();

    const sidebarWidth = 80; // Match Sidebar.tsx collapsed width (80px)
    const displayName = schoolName || 'Matokeo';

    const needsSchoolSetup = role === 'ADMIN' && profile && schoolOnboardingCompleted === false;

    React.useEffect(() => {
        if (!loading && needsSchoolSetup && pathname !== '/dashboard/onboarding') {
            router.push('/dashboard/onboarding');
        }
    }, [loading, needsSchoolSetup, pathname, router]);

    // Don't render sidebar and header if on onboarding page
    if (pathname === '/dashboard/onboarding') {
        return <main>{children}</main>;
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Mobile Top Bar */}
            <div className="mobile-topbar-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Image src="/images/logo.jpg" alt="Matokeo Logo" width={32} height={32}
                      style={{ borderRadius: 'var(--radius-md)', objectFit: 'contain' }}
                    />
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{displayName}</span>
                </div>
            </div>

            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

            <main className="dashboard-main" style={{
                '--sidebar-width': `${sidebarWidth}px`,
                display: 'flex', flexDirection: 'column',
            } as React.CSSProperties}>
                {children}
            </main>
        </div>
    );
}
