'use client';

import { useEffect } from 'react';

/**
 * Last resort: an error thrown by the root layout itself. This component
 * replaces the layout, so the stylesheet imported there is not applied — the
 * styling below is inline on purpose, and must stay that way.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Root layout error:', error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem 1rem',
                    background: '#0f0f14',
                    color: '#e2e8f0',
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    textAlign: 'center',
                }}
            >
                <div style={{ maxWidth: 420 }}>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                        Skulbase is temporarily unavailable
                    </h1>
                    <p
                        style={{
                            margin: '0.75rem 0 1.75rem',
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: '#94a3b8',
                        }}
                    >
                        We hit an unexpected problem loading the app. Your data is safe.
                    </p>
                    <button
                        type="button"
                        onClick={reset}
                        style={{
                            cursor: 'pointer',
                            border: 'none',
                            borderRadius: 12,
                            padding: '0.75rem 1.5rem',
                            fontSize: 15,
                            fontWeight: 600,
                            color: '#fff',
                            background: '#2563eb',
                        }}
                    >
                        Try again
                    </button>
                    {error.digest && (
                        <p style={{ marginTop: '1.5rem', fontSize: 11, color: '#64748b' }}>
                            Reference: {error.digest}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
