"use client";

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/components/ThemeProvider';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

export default function SignupPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleNextStep = () => {
    if (!firstName || !lastName || !email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setStep(2);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          first_name: firstName, 
          last_name: lastName, 
          school_name: schoolName,
          school_email: schoolEmail,
          school_phone: schoolPhone,
          school_address: schoolAddress
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to create account.');
        return;
      }

      if (!isLoaded || !signIn) {
        // Account was created successfully on the backend, but we can't auto-login.
        // Redirect them to the login page to complete the process.
        router.push('/login?created=1');
        return;
      }

      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push('/dashboard');
      } else {
        router.push(`/login?created=1&status=${result.status}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
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
            Create your account
          </h1>
          <p className="text-[15px] leading-relaxed"
            style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            Get started with Matokeo today
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
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); handleNextStep(); } : handleSubmit} className="flex flex-col gap-5">
            {step === 1 ? (
              <>
            {/* Name row */}
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-semibold"
                  style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                  First Name
                </label>
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="John"
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
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="text-xs font-semibold"
                  style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                  Last Name
                </label>
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Doe"
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
            </div>

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
                placeholder="you@school.com"
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
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
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
            ) : (
              <>
                {/* School Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold"
                    style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    School Name
                  </label>
                  <input
                    value={schoolName}
                    onChange={e => setSchoolName(e.target.value)}
                    placeholder="e.g. Nairobi Primary School"
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

                {/* School Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold"
                    style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    School Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={schoolEmail}
                    onChange={e => setSchoolEmail(e.target.value)}
                    placeholder="contact@school.edu"
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

                {/* School Phone */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold"
                    style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    School Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={schoolPhone}
                    onChange={e => setSchoolPhone(e.target.value)}
                    placeholder="+254 700 000 000"
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

                {/* School Address */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold"
                    style={{ color: isDark ? '#94a3b8' : '#475569' }}>
                    School Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={e => setSchoolAddress(e.target.value)}
                    placeholder="P.O. Box 1234, Nairobi"
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
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-6 text-[14px] font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'transparent'; }}>
                  Back
                </button>
              )}
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
                    {step === 1 ? 'Continue' : 'Create Account'}
                  </>
                )}
              </button>
            </div>

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
              onClick={signUpWithGoogle}
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
              Sign up with Google
            </button>
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

        {/* Role info */}
        <div className="mt-6 text-center text-xs leading-relaxed"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}>
          <span style={{ opacity: 0.8 }}>
            Your role will be assigned by your school administrator
          </span>
        </div>
      </div>
    </div>
  );
}
