"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();

    const [step, setStep] = useState<'verify' | 'setup'>('verify');
    const [phone, setPhone] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone.trim() || !inviteCode.trim()) {
            setError('Please enter both your phone number and invite code.');
            return;
        }
        setError('');
        setStep('setup');
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: phone.trim(),
                    invite_code: inviteCode.trim(),
                    email: email.trim(),
                    password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error);
                if (res.status === 404) {
                    setStep('verify'); // Go back to verify step
                }
            } else {
                setSuccess(data.message);
                setTimeout(() => router.push('/login'), 2500);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            padding: 'var(--space-6)',
        }}>
            <div style={{ width: '100%', maxWidth: 420 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 'var(--radius-lg)',
                        background: 'linear-gradient(135deg, var(--color-accent), #8B5CF6)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: '#fff',
                        marginBottom: 'var(--space-4)',
                    }}>RA</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 'var(--space-2)' }}>
                        {step === 'verify' ? 'Activate Your Account' : 'Set Up Your Login'}
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        {step === 'verify'
                            ? 'Enter your phone number and the invite code from your admin'
                            : 'Choose an email and password to sign in with'}
                    </p>
                </div>

                {/* Progress indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-accent)' }} />
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: step === 'setup' ? 'var(--color-accent)' : 'var(--color-border)' }} />
                </div>

                <div className="card" style={{ padding: 'var(--space-8)' }}>
                    {error && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            marginBottom: 'var(--space-6)',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: 'var(--color-danger)',
                            fontSize: 13,
                        }}>{error}</div>
                    )}
                    {success && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            marginBottom: 'var(--space-6)',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#10B981',
                            fontSize: 13,
                        }}>{success}</div>
                    )}

                    {/* Step 1: Phone + Invite Code */}
                    {step === 'verify' && (
                        <form onSubmit={handleVerify}>
                            <div style={{ marginBottom: 'var(--space-5)' }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    Phone Number
                                </label>
                                <input className="input-field" style={{ width: '100%' }} type="tel" placeholder="e.g. 0712345678" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus />
                            </div>

                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    Invite Code
                                </label>
                                <input
                                    className="input-field"
                                    style={{ width: '100%', fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', textAlign: 'center', fontFamily: 'var(--font-mono, monospace)' }}
                                    placeholder="000000"
                                    value={inviteCode}
                                    onChange={e => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    required
                                />
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                                    The 6-digit code given to you by your school administrator
                                </p>
                            </div>

                            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 'var(--space-3) var(--space-6)', fontSize: 15, fontWeight: 600 }}>
                                Continue →
                            </button>
                        </form>
                    )}

                    {/* Step 2: Email + Password */}
                    {step === 'setup' && (
                        <form onSubmit={handleRegister}>
                            <div style={{
                                background: 'var(--color-surface-raised)',
                                padding: 'var(--space-3) var(--space-4)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-5)',
                                fontSize: 13,
                            }}>
                                📱 Phone: <strong>{phone}</strong>
                                <button
                                    type="button"
                                    onClick={() => setStep('verify')}
                                    style={{ marginLeft: 'var(--space-3)', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                                >
                                    Change
                                </button>
                            </div>

                            <div style={{ marginBottom: 'var(--space-5)' }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    Email Address
                                </label>
                                <input className="input-field" style={{ width: '100%' }} type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                            </div>

                            <div style={{ marginBottom: 'var(--space-5)' }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    Password
                                </label>
                                <input className="input-field" style={{ width: '100%' }} type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                            </div>

                            <div style={{ marginBottom: 'var(--space-6)' }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    Confirm Password
                                </label>
                                <input className="input-field" style={{ width: '100%' }} type="password" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                            </div>

                            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: 'var(--space-3) var(--space-6)', fontSize: 15, fontWeight: 600 }}>
                                {loading ? 'Activating...' : '🚀 Activate Account'}
                            </button>
                        </form>
                    )}
                </div>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 'var(--space-6)' }}>
                    Already activated?{' '}
                    <a href="/login" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>Sign in</a>
                </p>
            </div>
        </div>
    );
}
