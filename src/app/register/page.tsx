"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { Eye, EyeOff, Loader2, UserPlus, Phone, Key, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

function RegisterContent() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setInviteCode(code);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !inviteCode || !email || !password) {
      toast.error('All fields are required.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          invite_code: inviteCode,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to complete registration.');
        return;
      }

      toast.success(data.message || 'Registration successful! Please sign in.');
      router.push('/login?created=1');
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
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
        {/* Header */}
        <div className="mb-8 text-center">
          <Image src="/images/logo.jpg" alt="Skulbase Logo" width={64} height={64}
            className="mx-auto mb-5 rounded-2xl object-cover"
            style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}
          />
          <h1 className="mb-2 text-[28px] font-extrabold tracking-tighter"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
            Accept Invitation
          </h1>
          <p className="text-[15px] leading-relaxed"
            style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            Set up your account using your invite details
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Phone Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold"
                style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +254700000000"
                  required
                  className="input-field h-[46px] w-full rounded-xl pl-10 pr-4 text-sm transition-all duration-200"
                  style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
              </div>
            </div>

            {/* Invite Code */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold"
                style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                Invite Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Enter invite code"
                  required
                  className="input-field h-[46px] w-full rounded-xl pl-10 pr-4 text-sm transition-all duration-200 font-mono uppercase"
                  style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <Key className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold"
                style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  required
                  className="input-field h-[46px] w-full rounded-xl pl-10 pr-4 text-sm transition-all duration-200"
                  style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold"
                style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                Choose Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="input-field h-[46px] w-full rounded-xl pl-10 pr-10 text-sm transition-all duration-200"
                  style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex flex-1 h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8B5CF6)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = '1'; }}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Register Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs leading-relaxed"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}>
          <span style={{ opacity: 0.8 }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold no-underline"
              style={{ color: '#6366f1' }}>
              Sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
