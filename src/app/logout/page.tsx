"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useTheme } from '@/components/ThemeProvider';
import { LogOut, ArrowLeft, Loader2 } from 'lucide-react';

export default function LogoutPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const { signOut, user } = useClerk();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } finally {
      window.location.href = '/login';
    }
  }

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
            ? 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)',
        }} />
      <div className="pointer-events-none absolute bottom-[10%] -right-[5%] h-[35vh] w-[35vw] rounded-full blur-[60px]"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)',
        }} />

      <div className="relative z-10 w-full max-w-[440px]">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 via-red-500 to-orange-400 text-2xl font-extrabold text-white shadow-lg"
            style={{ boxShadow: '0 8px 32px rgba(239,68,68,0.3)', letterSpacing: '-0.02em' }}>
            <LogOut className="h-6 w-6" />
          </div>
          <h1 className="mb-2 text-[28px] font-extrabold tracking-tighter"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
            Sign out
          </h1>
          <p className="text-[15px] leading-relaxed"
            style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
             Are you sure you want to sign out of Skulbase?
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-8 backdrop-blur-[20px]"
          style={{
            background: isDark ? 'rgba(30, 30, 46, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            boxShadow: isDark
              ? '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 20px 60px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm leading-relaxed"
              style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
              You will be redirected to the sign-in page after signing out.
            </p>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 16px rgba(239,68,68,0.3)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1'; }}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </>
              )}
            </button>

            {/* Cancel Button */}
            <button
              onClick={() => router.back()}
              disabled={loading}
              className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'transparent',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                color: isDark ? '#e2e8f0' : '#475569',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'transparent'; }}>
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
