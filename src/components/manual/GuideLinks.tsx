import { BookOpen, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MANUALS, manualPdfHref, manualWebHref, type ManualSlug } from '@/lib/manual';

/**
 * A compact “read the guide” strip for places people are new: onboarding and
 * activation. Guides open in a new tab so a half-filled form is not lost.
 */
export function GuideLinks({ slugs, lead = 'New to Skulbase?', className }: { slugs: readonly ManualSlug[]; lead?: string; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-4 text-center text-sm sm:flex-row sm:justify-center sm:text-left', className)}>
            <span className="flex items-center gap-2 font-semibold text-foreground">
                <BookOpen className="size-4 text-primary" aria-hidden /> {lead}
            </span>
            <span className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                {slugs.map(slug => (
                    <span key={slug} className="inline-flex items-center gap-2">
                        <a href={manualWebHref(slug)} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary no-underline hover:underline">
                            {MANUALS[slug].title}
                        </a>
                        <a href={manualPdfHref(slug)} download className="inline-flex items-center gap-1 text-xs text-muted-foreground no-underline hover:text-foreground" aria-label={`Download the ${MANUALS[slug].title} as a PDF`}>
                            <Download className="size-3.5" aria-hidden />PDF
                        </a>
                    </span>
                ))}
            </span>
        </div>
    );
}
