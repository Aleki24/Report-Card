"use client";

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ContentSkeleton } from '@/components/dashboard/LoadingSkeleton';
import { ManualView } from '@/components/manual/ManualView';
import { MANUALS, MANUAL_SLUGS, manualsFor, type ManualSlug } from '@/lib/manual';
import { cn } from '@/lib/utils';

/**
 * The in-app Help page: the guides for the signed-in person's role and each
 * duty they hold, as tabs. A teacher who is also the DOS gets both guides.
 */
export function RoleManual() {
    const { role, loading, access } = useAuth();
    const [picked, setPicked] = useState<ManualSlug | null>(null);
    if (loading || !role) return <ContentSkeleton />;

    const mine = manualsFor(role, access.duties);
    const slug = picked && mine.includes(picked) ? picked : mine[0];
    // Everyone can still read any other guide on the public help pages.
    const others = MANUAL_SLUGS.filter(s => !mine.includes(s) && (role === 'ADMIN' || s === 'student' || s === 'parent'));

    return (
        <div className="flex flex-col gap-6">
            {mine.length > 1 && (
                <div role="tablist" aria-label="Your guides" className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/50 p-1 [scrollbar-width:none] print:hidden">
                    {mine.map(s => (
                        <button
                            key={s}
                            type="button"
                            role="tab"
                            aria-selected={s === slug}
                            onClick={() => setPicked(s)}
                            className={cn('min-h-10 shrink-0 rounded-xl px-4 text-sm font-medium transition-colors', s === slug ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {MANUALS[s].title}
                        </button>
                    ))}
                </div>
            )}
            <ManualView manual={MANUALS[slug]} otherGuides={others} />
        </div>
    );
}
