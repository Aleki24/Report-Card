"use client";

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { Eye, EyeOff, Loader2, LogIn, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [showSuccess] = useState(typeof window !== 'undefined' && window.location.search.includes('created=1'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setLoading(true);

    try {
      if (needsMfa) {
        const result = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: mfaCode,
        });
        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId });
          router.push('/dashboard');
        } else {
          toast.error(`Verification incomplete: ${result.status}`);
        }
      } else {
        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId });
          router.push('/dashboard');
        } else if (result.status === 'needs_second_factor') {
          const hasEmailCode = result.supportedSecondFactors?.some((f: any) => f.strategy === 'email_code');
          if (hasEmailCode) {
            await signIn.prepareSecondFactor({ strategy: 'email_code' });
            setNeedsMfa(true);
          } else {
            toast.error('Account requires a second factor not supported here.');
          }
        } else {
          console.log('Incomplete sign-in:', result);
          (window as any).__debugResult = result;
          toast.error(`Sign in incomplete: ${result.status}. Check console for details.`);
        }
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.code === 'form_identifier_not_found'
          ? 'No account found with this email.'
          : err?.errors?.[0]?.code === 'form_password_incorrect'
            ? 'Incorrect password.'
            : err?.errors?.[0]?.longMessage || 'Invalid email, password, or code.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!isLoaded || !signIn) return;
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      });
    } catch {
      setGoogleLoading(false);
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
          <Image src="/images/logo.jpg" alt="Matokeo Logo" width={64} height={64}
            className="mx-auto mb-5 rounded-2xl object-cover"
            style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}
          />
          <h1 className="mb-2 text-[28px] font-extrabold tracking-tighter"
            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
            Welcome back
          </h1>
          <p className="text-[15px] leading-relaxed"
            style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            Sign in to your Matokeo account to continue
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
          {showSuccess && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium mb-2"
              style={{
                backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)',
                color: isDark ? '#86efac' : '#16a34a',
                border: `1px solid ${isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.15)'}`,
              }}>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Account created! Sign in with your credentials.
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {needsMfa ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold"
                  style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                  Verification Code
                </label>
                <p className="text-xs mb-2" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                  We've sent a 6-digit code to your email.
                </p>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="input-field h-[46px] rounded-xl px-4 text-sm transition-all duration-200"
                  style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ) : (
              <>
                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold"
                    style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="input-field h-[46px] rounded-xl px-4 text-sm transition-all duration-200"
                    style={{
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                    onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold"
                    style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="input-field h-[46px] w-full rounded-xl px-4 text-sm transition-all duration-200"
                      style={{
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
                      onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-1"
                      style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
            
            {/* Debug Info */}
            {typeof window !== 'undefined' && (window as any).__debugResult && (
              <pre className="text-xs overflow-auto p-2 bg-black/10 rounded">
                {JSON.stringify((window as any).__debugResult, null, 2)}
              </pre>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isLoaded || loading}
              className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <LogIn className="h-4 w-4" />
                  {needsMfa ? 'Verify Code' : 'Sign In'}
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1"
                style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
              <span className="text-xs font-medium"
                style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                or continue with
              </span>
              <div className="h-px flex-1"
                style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={!isLoaded || googleLoading}
              className="flex h-[46px] cursor-pointer items-center justify-center gap-3 rounded-xl border text-[14px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                color: isDark ? '#e2e8f0' : '#1e293b',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              }}
              onMouseEnter={e => { if (!googleLoading) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { if (!googleLoading) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; }}>
              {googleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Sign in with Google
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs leading-relaxed"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}>
          <span style={{ opacity: 0.8 }}>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold no-underline"
              style={{ color: '#6366f1' }}>
              Create one
            </Link>
          </span>
        </div>

        {/* Role info */}
        <div className="mt-6 text-center text-xs leading-relaxed"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}>
          <span style={{ opacity: 0.8 }}>
            Access is role-based · Admin · Class Teacher · Subject Teacher · Student
          </span>
        </div>
      </div>
    </div>
  );
}
