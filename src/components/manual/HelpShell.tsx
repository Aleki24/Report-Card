import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';

/** The public help pages' frame: a slim header (hidden when printing) and the page. */
export function HelpShell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-dvh bg-background">
            <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur print:hidden">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2 no-underline">
                        <Image src="/images/logo.png" alt="" width={28} height={28} className="rounded-lg" />
                        <span className="font-display text-base font-bold"><Wordmark /></span>
                    </Link>
                    <nav className="flex items-center gap-4 text-sm">
                        <Link href="/help" className="font-medium text-muted-foreground no-underline hover:text-foreground">All guides</Link>
                        <Link href="/login" className="font-semibold text-primary no-underline">Sign in</Link>
                    </nav>
                </div>
            </header>
            <main className="px-4 py-8 sm:px-6 sm:py-12 print:p-0">{children}</main>
        </div>
    );
}
