'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Root error boundary. The dashboard and student areas have their own, so this
 * one catches the public surface — landing, pricing, contact, sign-in, and the
 * public /verify certificate page — which previously fell through to Next's
 * default error screen.
 *
 * Unlike the dashboard boundary this does not print error.message: these pages
 * are reachable by anyone, and a raw message can carry internals. The digest is
 * shown instead so a report can be matched to the server log.
 */
export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Unhandled error:', error);
    }, [error]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
            <div className="w-full max-w-md text-center">
                <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Something went wrong
                </h1>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    This page didn&apos;t load. It is usually temporary — trying again often
                    works.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button type="button" onClick={reset} className="btn-primary w-full sm:w-auto">
                        Try again
                    </button>
                    <Link href="/" className="btn-secondary w-full sm:w-auto">
                        Back to home
                    </Link>
                </div>

                {error.digest && (
                    <p className="mt-6 font-mono text-[11px] text-muted-foreground/70">
                        Reference: {error.digest}
                    </p>
                )}
            </div>
        </main>
    );
}
