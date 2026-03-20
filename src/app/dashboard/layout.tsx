"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthProvider, useAuth } from '@/components/AuthProvider';

function DashboardContent({ children }: { children: React.ReactNode }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { schoolName, profile, role } = useAuth();

    const sidebarWidth = collapsed ? 72 : 260;
    const displayName = schoolName || 'ResultsApp';

    // Show setup banner for admins who haven't created their school yet
    const needsSchoolSetup = role === 'ADMIN' && profile && !profile.school_id;

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Mobile Top Bar */}
            <div className="mobile-topbar-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--color-accent), #8B5CF6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#fff',
                    }}>{displayName.substring(0, 2).toUpperCase()}</div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{displayName}</span>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 8 }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {mobileMenuOpen
                            ? <path d="M18 6L6 18M6 6l12 12" />
                            : <path d="M3 12h18M3 6h18M3 18h18" />
                        }
                    </svg>
                </button>
            </div>

            <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
            />

            <main className="dashboard-main" style={{
                '--sidebar-width': `${sidebarWidth}px`,
                display: 'flex', flexDirection: 'column',
            } as React.CSSProperties}>
                {/* ── New Admin Setup Banner ── */}
                {needsSchoolSetup && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                        border: '1px solid rgba(99,102,241,0.4)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4) var(--space-6)',
                        marginBottom: 'var(--space-6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-4)',
                        flexWrap: 'wrap',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <span style={{ fontSize: 24 }}>🏫</span>
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: 2 }}>Welcome! Set up your school first</p>
                                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                                    Before adding students and users, create your school profile in Settings.
                                </p>
                            </div>
                        </div>
                        <Link
                            href="/dashboard/settings"
                            className="btn-primary"
                            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                            Go to Settings →
                        </Link>
                    </div>
                )}
                {children}
            </main>
        </div>
    );

}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <DashboardContent>{children}</DashboardContent>
        </AuthProvider>
    );
}
