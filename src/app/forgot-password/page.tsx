"use client";

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { Eye, EyeOff, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Lets a Google-first account (no password credential yet) — or anyone who
 * forgot their password — set/reset a password via an emailed code. Because
 * Clerk links accounts by verified email, this adds a password credential to
 * the SAME Clerk user as their Google sign-in, so afterwards either method
 * works interchangeably.
 */
export default function ForgotPasswordPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
  };
  const labelColor = { color: isDark ? '#94a3b8' : '#475569' };

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setStep('reset');
      toast.success('Check your email for a 6-digit code.');
    } catch (err) {
      const apiError = isClerkAPIResponseError(err) ? err.errors[0] : undefined;
      const msg = apiError?.code === 'form_identifier_not_found'
        ? 'No account found with this email.'
        : apiError?.longMessage || 'Could not send a reset code. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
      });

      if (attempt.status === 'needs_new_password') {
        const result = await signIn.resetPassword({ password, signOutOfOtherSessions: true });
        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId });
          toast.success('Password set! You can now sign in with either Google or your password.');
          router.push('/dashboard');
          return;
        }
        toast.error(`Unexpected status: ${result.status}. Please try again.`);
      } else if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.push('/dashboard');
      } else {
        toast.error(`Unexpected status: ${attempt.status}. Please try again.`);
      }
    } catch (err) {
      const apiError = isClerkAPIResponseError(err) ? err.errors[0] : undefined;
      const msg = apiError?.code === 'form_code_incorrect'
        ? 'That code is incorrect or has expired.'
        : apiError?.longMessage || 'Could not reset your password. Please try again.';
      toast.error(msg);
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
      <div className="pointer-events-none absolute -top-1/5 left-[10%] h-[50vh] w-[50vw] rounded-full blur-[80px]"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }} />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <Image src="/images/logo.jpg" alt="Skulbase Logo" width={64} height={64}
            className="mx-auto mb-5 rounded-2xl object-cover"
            style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.3)' }}
          />
          <h1 className="mb-2 text-[28px] font-extrabold tracking-tighter" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
            {step === 'request' ? 'Reset your password' : 'Enter your code'}
          </h1>
          <p className="text-[15px] leading-relaxed" style={labelColor}>
            {step === 'request'
              ? "We'll email you a 6-digit code — this works even if you originally signed in with Google."
              : `Enter the code sent to ${email} and choose a new password.`}
          </p>
        </div>

        <div className="rounded-2xl border p-8 backdrop-blur-[20px]"
          style={{
            background: isDark ? 'rgba(30, 30, 46, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            boxShadow: isDark
              ? '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 20px 60px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
          {step === 'request' ? (
            <form onSubmit={handleRequestCode} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={labelColor}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  required
                  className="input-field h-[46px] rounded-xl px-4 text-sm transition-all duration-200"
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={!isLoaded || loading}
                className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8B5CF6)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Send Reset Code</>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={labelColor}>Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="input-field h-[46px] rounded-xl px-4 text-sm transition-all duration-200"
                  style={inputStyle}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={labelColor}>New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="input-field h-[46px] w-full rounded-xl px-4 text-sm transition-all duration-200"
                    style={inputStyle}
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
              <button
                type="submit"
                disabled={!isLoaded || loading}
                className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border-none text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8B5CF6)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Set New Password'}
              </button>
              <button
                type="button"
                onClick={() => setStep('request')}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold"
                style={{ color: isDark ? '#94a3b8' : '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-xs leading-relaxed" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
          <span style={{ opacity: 0.8 }}>
            Remembered it?{' '}
            <Link href="/login" className="font-semibold no-underline" style={{ color: '#6366f1' }}>
              Back to sign in
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
