"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, GraduationCap, School } from 'lucide-react';
import { CardHeading } from '@/components/ui';

interface AcademicLevel { id: string; code: string; name: string }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string }

/**
 * The national curricula and their grades. They are shared by every school
 * and managed centrally, so this is for reference; a school chooses which
 * grades it teaches by giving them classes on the Classes page.
 */
export function AcademicStructureTab({ academicLevels, grades }: { academicLevels: AcademicLevel[]; grades: Grade[] }) {
    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/classes"
                className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
                <CardHeading icon={School} hue="amber" className="mb-0" title="Choose the grades you teach on the Classes page" description="Add classes (streams) to a grade and it becomes part of your school. The lists below are the national curricula, the same for every school." />
                <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                    Open Classes
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
            </Link>

            <div className="grid gap-4 md:grid-cols-2">
                {academicLevels.map(level => {
                    const levelGrades = grades.filter(g => g.academic_level_id === level.id).sort((a, b) => a.numeric_order - b.numeric_order);
                    return (
                        <section key={level.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
                            <CardHeading icon={GraduationCap} hue={level.code === 'CBC' ? 'emerald' : 'violet'} title={level.name} description={`${levelGrades.length} grade${levelGrades.length === 1 ? '' : 's'} · code ${level.code}`} />
                            {levelGrades.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No grades listed.</p>
                            ) : (
                                <ul className="flex flex-wrap gap-1.5">
                                    {levelGrades.map(g => (
                                        <li key={g.id} className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-sm">{g.name_display}</li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
