import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, BookOpen, Download, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MANUALS, manualPdfHref, type Manual, type ManualFigure, type ManualSection, type ManualSlug } from '@/lib/manual';

function Figure({ figure }: { figure: ManualFigure }) {
    const phone = figure.device === 'phone';
    return (
        <figure className={cn('my-5 break-inside-avoid', phone && 'mx-auto max-w-[260px]')}>
            <div className={cn('overflow-hidden border border-border bg-muted/40 shadow-sm print:overflow-visible print:rounded-none print:shadow-none', phone ? 'rounded-[1.75rem] border-4 border-foreground/80' : 'rounded-xl')}>
                <Image
                    src={figure.src}
                    alt={figure.alt}
                    width={figure.width}
                    height={figure.height}
                    sizes={phone ? '260px' : '(min-width: 1024px) 760px, 100vw'}
                    className="h-auto w-full"
                />
            </div>
            <figcaption className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">{figure.caption}</figcaption>
        </figure>
    );
}

function Section({ section, number }: { section: ManualSection; number: string }) {
    return (
        <section id={section.id} className="scroll-mt-24 border-t border-border/60 pt-6 first:border-t-0 first:pt-0">
            <h3 className="font-display text-lg font-bold tracking-tight text-foreground">
                <span className="mr-2 text-muted-foreground tabular-nums">{number}</span>{section.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{section.summary}</p>

            {section.figure && <Figure figure={section.figure} />}

            {section.steps && (
                <ol className="mt-4 flex flex-col gap-3">
                    {section.steps.map((step, i) => (
                        <li key={step.title} className="flex break-inside-avoid gap-3">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden>{i + 1}</span>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            {section.points && (
                <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary">
                    {section.points.map(point => <li key={point}>{point}</li>)}
                </ul>
            )}

            {section.tip && (
                <p className="mt-4 flex break-inside-avoid gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/[0.07] p-3 text-sm leading-relaxed text-foreground">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                    <span><strong>Tip: </strong>{section.tip}</span>
                </p>
            )}
            {section.caution && (
                <p className="mt-4 flex break-inside-avoid gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/[0.08] p-3 text-sm leading-relaxed text-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <span><strong>Good to know: </strong>{section.caution}</span>
                </p>
            )}
        </section>
    );
}

interface ManualViewProps {
    manual: Manual;
    /** Links to the other guides, for switching. */
    otherGuides?: readonly ManualSlug[];
    /** Where another guide opens: the public page or an in-app route. */
    guideHref?: (slug: ManualSlug) => string;
}

/**
 * A whole user guide: cover, contents, and every chapter with its
 * screenshots, steps and tips. Plain markup with no client state, so the
 * same component renders the in-app Help page, the public /help pages and,
 * printed, the downloadable PDF.
 */
export function ManualView({ manual, otherGuides = [], guideHref = slug => `/help/${slug}` }: ManualViewProps) {
    return (
        <article className="mx-auto w-full max-w-3xl pb-16 print:max-w-none print:pb-0">
            <header className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
                    <BookOpen className="size-4" aria-hidden /> Skulbase user guide
                </p>
                <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{manual.title}</h1>
                <p className="mt-1 text-sm font-medium text-muted-foreground">For {manual.audience.charAt(0).toLowerCase() + manual.audience.slice(1)}</p>
                <p className="mt-4 text-[15px] leading-relaxed text-foreground/85">{manual.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2 print:hidden">
                    <a href={manualPdfHref(manual.slug)} download className="btn-primary no-underline">
                        <Download className="size-4" aria-hidden /> Download PDF
                    </a>
                </div>
                {otherGuides.length > 0 && (
                    <p className="mt-4 text-xs text-muted-foreground print:hidden">
                        Other guides:{' '}
                        {otherGuides.map((slug, i) => (
                            <span key={slug}>
                                {i > 0 && ' · '}
                                <Link href={guideHref(slug)} className="font-semibold text-primary no-underline hover:underline">{MANUALS[slug].title}</Link>
                            </span>
                        ))}
                    </p>
                )}
            </header>

            <nav aria-label="Contents" className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8 print:mt-8 print:border-0 print:p-0 print:shadow-none">
                <h2 className="font-display text-lg font-bold text-foreground">Contents</h2>
                <ol className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    {manual.chapters.map((chapter, c) => (
                        <li key={chapter.id} className="break-inside-avoid">
                            <a href={`#${chapter.id}`} className="font-semibold text-foreground no-underline hover:text-primary">
                                <span className="mr-1.5 text-primary tabular-nums">{c + 1}.</span>{chapter.title}
                            </a>
                            <ul className="mt-1 flex flex-col gap-0.5 pl-5">
                                {chapter.sections.map(section => (
                                    <li key={section.id}>
                                        <a href={`#${section.id}`} className="text-xs text-muted-foreground no-underline hover:text-primary">{section.title}</a>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol>
            </nav>

            {manual.chapters.map((chapter, c) => (
                <section
                    key={chapter.id}
                    id={chapter.id}
                    aria-labelledby={`${chapter.id}-title`}
                    className="mt-6 scroll-mt-24 rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8 print:mt-0 print:break-before-page print:border-0 print:p-0 print:shadow-none"
                >
                    <p className="text-xs font-semibold tracking-widest text-primary uppercase">Chapter {c + 1}</p>
                    <h2 id={`${chapter.id}-title`} className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">{chapter.title}</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{chapter.intro}</p>
                    <div className="mt-6 flex flex-col gap-8">
                        {chapter.sections.map((section, s) => (
                            <Section key={section.id} section={section} number={`${c + 1}.${s + 1}`} />
                        ))}
                    </div>
                </section>
            ))}
        </article>
    );
}
