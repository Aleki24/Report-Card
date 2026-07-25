"use client";

import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';

/**
 * The gradient/glass frame shared by the QR portal screens, matching the
 * look of /login and /signup so a scanned code lands somewhere familiar.
 */
export function PortalShell({ children }: { children: React.ReactNode }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
            style={{
                background: isDark
                    ? 'linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)'
                    : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
            }}>
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-1/5 left-[10%] h-[50vh] w-[50vw] rounded-full blur-[80px]"
                style={{
                    background: isDark
                        ? 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
                }} />
            <div className="pointer-events-none absolute bottom-[10%] -right-[5%] h-[35vh] w-[35vw] rounded-full blur-[60px]"
                style={{
                    background: isDark
                        ? 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
                }} />

            <div className="relative z-10 w-full max-w-[440px]">
                {children}
            </div>
        </div>
    );
}

export function PortalLogo() {
    return (
        <Image src="/images/logo.png" alt="Skulbase Logo" width={64} height={64}
            className="mx-auto mb-5 rounded-2xl object-cover"
            style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}
        />
    );
}

/** The frosted card the portal forms sit on. */
export function PortalCard({ children }: { children: React.ReactNode }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="rounded-2xl border p-8 backdrop-blur-[20px]"
            style={{
                background: isDark ? 'rgba(30, 30, 46, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                boxShadow: isDark
                    ? '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 20px 60px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}>
            {children}
        </div>
    );
}

/** A labelled text input styled to match the auth screens. */
export function PortalField({
    label, hint, ...inputProps
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                {label}
            </label>
            <input
                {...inputProps}
                className="input-field h-[46px] w-full rounded-xl px-4 text-sm transition-all duration-200"
                style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
            {hint && (
                <span className="text-[11px] leading-relaxed" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                    {hint}
                </span>
            )}
        </div>
    );
}
