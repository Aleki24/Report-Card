"use client";

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthProvider, useAuth } from '@/components/AuthProvider';

function DashboardContent({ children }: { children: React.ReactNode }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { schoolName } = useAuth();

    const sidebarWidth = collapsed ? 72 : 260;
    const displayName = schoolName || 'ResultsApp';

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
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
            } as React.CSSProperties}>
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
