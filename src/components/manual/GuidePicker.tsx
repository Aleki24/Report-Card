import Link from 'next/link';
import {
    BedDouble, Briefcase, Bus, Download, GraduationCap, HeartHandshake, HeartPulse, Landmark, Library, PenLine, School, UserRound, Users,
    type LucideIcon,
} from 'lucide-react';
import { MANUALS, MANUAL_SLUGS, manualPdfHref, type ManualSlug } from '@/lib/manual';

const ICONS: Record<ManualSlug, LucideIcon> = {
    admin: School,
    'class-teacher': Users,
    'subject-teacher': PenLine,
    staff: UserRound,
    student: GraduationCap,
    parent: HeartHandshake,
    leadership: Briefcase,
    finance: Landmark,
    welfare: BedDouble,
    health: HeartPulse,
    transport: Bus,
    operations: Library,
};

/** One card per guide: read it online or download the PDF. */
export function GuidePicker({ slugs = MANUAL_SLUGS, guideHref = slug => `/help/${slug}` }: { slugs?: readonly ManualSlug[]; guideHref?: (slug: ManualSlug) => string }) {
    return (
        <ul className="grid gap-4 sm:grid-cols-2">
            {slugs.map(slug => {
                const manual = MANUALS[slug];
                const Icon = ICONS[slug];
                return (
                    <li key={slug} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden><Icon className="size-5" /></span>
                            <div className="min-w-0">
                                <h2 className="font-display text-base font-bold text-foreground">{manual.title}</h2>
                                <p className="text-xs text-muted-foreground">{manual.audience}</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{manual.summary}</p>
                        <div className="mt-auto flex flex-wrap gap-2">
                            <Link href={guideHref(slug)} className="btn-secondary h-9 text-sm no-underline">Read online</Link>
                            <a href={manualPdfHref(slug)} download className="btn-secondary h-9 text-sm no-underline"><Download className="size-4" aria-hidden />PDF</a>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
