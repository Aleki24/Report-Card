"use client";

import { useMemo } from 'react';
import { catalogueLevelForGrade, compulsoryCodes } from '@/lib/standard-subjects';
import { PREDEFINED_SUBJECTS, type EducationLevel } from '@/lib/subject-definitions';
import type { StandardGrade } from '@/components/onboarding/ClassesStep';

type Props = {
    /** The grades the school ticked. */
    grades: StandardGrade[];
    offer: boolean;
    onOfferChange: (offer: boolean) => void;
};

const LEVEL_LABELS: Record<EducationLevel, string> = {
    CBC_LOWER_PRIMARY: 'Pre-Primary & Lower Primary',
    CBC_UPPER_PRIMARY: 'Upper Primary',
    CBC_JUNIOR_SCHOOL: 'Junior School',
    CBC_SENIOR_SCHOOL: 'Senior School',
    '844_SECONDARY': '8-4-4 Secondary',
};

const NAME_BY_CODE = new Map(PREDEFINED_SUBJECTS.map(s => [s.code, s.name]));

/**
 * Offer the compulsory subjects of every level the school teaches, so exams
 * can be set on day one. Electives and optional subjects are the school's
 * own choice, made on the Subjects page.
 */
export default function SubjectsStep({ grades, offer, onOfferChange }: Props) {
    const levels = useMemo(() => {
        const set = new Set<EducationLevel>();
        for (const g of grades) {
            const level = catalogueLevelForGrade({ code: g.code, name_display: g.name });
            if (level) set.add(level);
        }
        return [...set];
    }, [grades]);

    return (
        <div className="space-y-6">
            <header>
                <h2 className="mb-1 text-xl font-bold">Subjects</h2>
                <p className="text-sm text-muted-foreground">
                    Exams and mark sheets need subjects. Start with the ones every learner takes; add electives and optional
                    subjects on the Subjects page once you&apos;re in.
                </p>
            </header>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={offer} onChange={e => onOfferChange(e.target.checked)} />
                <span>
                    <span className="block text-sm font-medium">Add the compulsory subjects for my classes (recommended)</span>
                    <span className="block text-xs text-muted-foreground">From the standard Kenyan curriculum list, with their official codes.</span>
                </span>
            </label>

            {offer && (levels.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    {levels.map(level => (
                        <section key={level} className="rounded-xl border border-border p-4">
                            <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{LEVEL_LABELS[level]}</h3>
                            <ul className="flex flex-wrap gap-1.5">
                                {compulsoryCodes(level).map(code => (
                                    <li key={code} className="rounded-full bg-muted px-2.5 py-1 text-xs">{NAME_BY_CODE.get(code) ?? code}</li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            ) : (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    There is no standard subject list for the classes you picked — add your subjects on the Subjects page.
                </p>
            ))}
        </div>
    );
}
