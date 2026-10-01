/**
 * The Skulbase user guide, as data: one manual per kind of user, rendered in
 * the app, on the public /help pages and into the downloadable PDFs.
 */

export type ManualSlug =
    | 'admin' | 'class-teacher' | 'subject-teacher' | 'staff' | 'student' | 'parent'
    | 'leadership' | 'finance' | 'welfare' | 'health' | 'transport' | 'operations';

/** A screenshot of the real app (captured from the demo school). */
export interface ManualFigure {
    src: string;
    width: number;
    height: number;
    alt: string;
    caption: string;
    /** Phone shots are drawn narrower. */
    device: 'desktop' | 'phone';
}

export interface ManualStep {
    title: string;
    body: string;
}

export interface ManualSection {
    id: string;
    title: string;
    /** What this part of the app is for, in a sentence or two. */
    summary: string;
    figure?: ManualFigure;
    /** A numbered how-to. */
    steps?: readonly ManualStep[];
    /** Facts worth knowing, as bullets. */
    points?: readonly string[];
    tip?: string;
    /** Something that is easy to get wrong. */
    caution?: string;
}

export interface ManualChapter {
    id: string;
    title: string;
    intro: string;
    sections: readonly ManualSection[];
}

export interface Manual {
    slug: ManualSlug;
    /** "Administrator guide". */
    title: string;
    /** Who it is for, e.g. "Principals, deputies and school administrators". */
    audience: string;
    summary: string;
    chapters: readonly ManualChapter[];
}
