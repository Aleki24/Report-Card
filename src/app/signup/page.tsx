"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
    const router = useRouter();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error);
            } else {
                setSuccess(data.message);
                setTimeout(() => router.push('/login'), 2000);
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
                        Create Your Account
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        Register as a school administrator to get started
                    </p>
                </div>

                <div className="card" style={{ padding: 'var(--space-8)' }}>
                    <form onSubmit={handleSignup}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    First Name
                                </label>
                                <input className="input-field" style={{ width: '100%' }} value={firstName} onChange={e => setFirstName(e.target.value)} required autoFocus />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                    Last Name
                                </label>
                                <input className="input-field" style={{ width: '100%' }} value={lastName} onChange={e => setLastName(e.target.value)} required />
                            </div>
                        </div>

                        <div style={{ marginBottom: 'var(--space-5)' }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                Email Address
                            </label>
                            <input className="input-field" style={{ width: '100%' }} type="email" placeholder="you@school.com" value={email} onChange={e => setEmail(e.target.value)} required />
                        </div>

                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
                                Password
                            </label>
                            <input className="input-field" style={{ width: '100%' }} type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: 'var(--space-3) var(--space-6)', fontSize: 15, fontWeight: 600 }}>
                            {loading ? 'Creating Account...' : '🚀 Create Account'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 'var(--space-6)' }}>
                    Already have an account?{' '}
                    <a href="/login" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>Sign in</a>
                </p>
            </div>
        </div>
    );
}
