"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ActivatePage() {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!code.trim()) {
            setError('Please enter your invite code.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code.trim(),
                    email: email.trim() || undefined,
                    password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Activation failed');
            }

            setSuccess('Account activated successfully! Redirecting to login...');
            
            setTimeout(() => {
                router.push('/login');
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'An error occurred during activation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />

            <div 
                className="w-full max-w-md p-8 bg-card border border-border/50 rounded-2xl shadow-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl text-primary">🔐</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Activate Account</h1>
                    <p className="text-muted-foreground text-sm">
                        Enter your invite code and set up your password.
                    </p>
                </div>

                {error && (
                    <div className="p-3 mb-6 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-3 mb-6 text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-md text-center font-medium">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Invite Code <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="input-field w-full font-mono uppercase tracking-widest text-center"
                            placeholder="A7X3K9"
                            maxLength={6}
                            required
                            disabled={loading || !!success}
                        />
                        <p className="text-xs text-muted-foreground mt-1 text-center">The 6-character code given by your admin</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Email Address (Optional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field w-full"
                            placeholder="your.email@example.com"
                            disabled={loading || !!success}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Add an email to help recover your account later</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">New Password <span className="text-red-500">*</span></label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field w-full"
                            placeholder="Min. 8 characters"
                            required
                            disabled={loading || !!success}
                            minLength={8}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Confirm Password <span className="text-red-500">*</span></label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input-field w-full"
                            placeholder="Repeat your password"
                            required
                            disabled={loading || !!success}
                            minLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !!success}
                        className="btn-primary w-full py-3 mt-6 text-sm font-semibold tracking-wide"
                    >
                        {loading ? 'Activating...' : 'Activate Account'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => router.push('/login')}
                        className="text-sm text-primary hover:text-primary/80 transition-colors"
                        disabled={loading}
                    >
                        Already have an account? Log in
                    </button>
                </div>
            </div>
        </div>
    );
}
