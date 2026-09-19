import Link from 'next/link';

/**
 * Shown for any URL that matches no route — a mistyped address, a bookmark to a
 * page that has since moved, or a record that has been deleted. Without this
 * file Next serves its own unstyled default, which offers no way back into the
 * app; a teacher who lands there has to know to edit the address bar.
 */
export const metadata = {
    title: 'Page not found · Skulbase',
};

export default function NotFound() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
            <div className="w-full max-w-md text-center">
                <p className="font-[family-name:var(--font-display)] text-6xl font-extrabold tracking-tight text-primary sm:text-7xl">
                    404
                </p>

                <h1 className="mt-4 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    We couldn&apos;t find that page
                </h1>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    The link may be out of date, or the page may have been moved. Nothing has
                    been lost — pick up where you left off below.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link href="/dashboard" className="btn-primary w-full sm:w-auto">
                        Go to dashboard
                    </Link>
                    <Link href="/" className="btn-secondary w-full sm:w-auto">
                        Back to home
                    </Link>
                </div>
            </div>
        </main>
    );
}
