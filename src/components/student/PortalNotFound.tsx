"use client";

import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { PortalShell, PortalCard, PortalLogo } from './PortalShell';

/**
 * Shown when a scanned token resolves to nothing. Kept deliberately vague —
 * it must not reveal whether a token exists but is inactive, or never
 * existed at all.
 */
export function PortalNotFound() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <PortalShell>
            <div className="mb-8 text-center">
                <PortalLogo />
                <h1 className="mb-2 text-[28px] font-extrabold tracking-tighter"
                    style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                    This code isn&apos;t working
                </h1>
            </div>

            <PortalCard>
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{ background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)' }}>
                        <QrCode className="h-6 w-6" style={{ color: '#6366f1' }} />
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        We couldn&apos;t match this QR code to a student. It may be from an
                        old report card, or the code may have been scanned incorrectly.
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                        Ask your school for a fresh report card, or sign in with your
                        username and password if you already have an account.
                    </p>
                    <Link href="/login"
                        className="mt-2 flex h-[46px] w-full cursor-pointer items-center justify-center rounded-xl text-[15px] font-semibold text-white no-underline transition-all duration-200"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8B5CF6)',
                            boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                        }}>
                        Go to sign in
                    </Link>
                </div>
            </PortalCard>
        </PortalShell>
    );
}
