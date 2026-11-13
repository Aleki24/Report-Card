"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen } from 'lucide-react';

/** The guide for whoever is signed in: learners, parents and staff each have their own. */
const guideFor = (path: string) => (path.startsWith('/student') ? '/student/help' : path.startsWith('/parent') ? '/parent/help' : '/dashboard/help');

/** A quiet link to the guide, for when doing it is not enough. */
export function GuideLink() {
    const pathname = usePathname() ?? '';
    const href = guideFor(pathname);
    if (pathname === href) return null;
    return (
        <Link href={href} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground">
            <BookOpen className="size-3.5" aria-hidden />Guide
        </Link>
    );
}
