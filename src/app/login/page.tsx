"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await signIn('credentials', {
            email: email.trim(),
            password,
            redirect: false,
        });

        if (result?.error) {
            setError(result.error);
            setLoading(false);
        } else {
            router.push('/dashboard');
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
            <div style={{
                width: '100%',
                maxWidth: 420,
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: 'var(--radius-lg)',
                        background: 'linear-gradient(135deg, var(--color-accent), #8B5CF6)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 22,
                        color: '#fff',
                        marginBottom: 'var(--space-4)',
                    }}>
                        RA
                    </div>
                    <h1 style={{
                        fontSize: 24,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        marginBottom: 'var(--space-2)',
                    }}>
                        Sign in to ResultsApp
                    </h1>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                        Enter your credentials to access your dashboard
                    </p>
                </div>

                {/* Login Form */}
                <div className="card" style={{ padding: 'var(--space-8)' }}>
                    <form onSubmit={handleLogin}>
                        {error && (
                            <div style={{
                                padding: 'var(--space-3) var(--space-4)',
                                marginBottom: 'var(--space-6)',
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: 'var(--color-danger)',
                                fontSize: 13,
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{ marginBottom: 'var(--space-5)' }}>
                            <label style={{
                                display: 'block',
                                fontSize: 13,
                                fontWeight: 500,
                                marginBottom: 'var(--space-2)',
                                color: 'var(--color-text-secondary)',
                            }}>
                                Email Address
                            </label>
                            <input
                                className="input-field"
                                style={{ width: '100%' }}
                                type="email"
                                placeholder="you@school.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <label style={{
                                display: 'block',
                                fontSize: 13,
                                fontWeight: 500,
                                marginBottom: 'var(--space-2)',
                                color: 'var(--color-text-secondary)',
                            }}>
                                Password
                            </label>
                            <input
                                className="input-field"
                                style={{ width: '100%' }}
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{
                                width: '100%',
                                justifyContent: 'center',
                                padding: 'var(--space-3) var(--space-6)',
                                fontSize: 15,
                                fontWeight: 600,
                            }}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                </div>

                <p style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    marginTop: 'var(--space-6)',
                }}>
                    <a href="/signup" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>Admin signup</a>
                    {' · '}
                    <a href="/register" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>Activate invite</a>
                </p>
            </div>
        </div>
    );
}
