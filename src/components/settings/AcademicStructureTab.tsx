"use client";

import React from 'react';
import { InfoGuide } from '@/components/ui/InfoGuide';

interface AcademicLevel { id: string; code: string; name: string; }
interface Grade { id: string; code: string; name_display: string; numeric_order: number; academic_level_id: string; }

interface AcademicStructureTabProps {
    academicLevels: AcademicLevel[];
    grades: Grade[];
}

export function AcademicStructureTab({ academicLevels, grades }: AcademicStructureTabProps) {
    return (
        <>
            <InfoGuide title="How academic structure works:" className="col-span-1 lg:col-span-3">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li><strong>Academic Levels</strong> represent curricula (e.g., CBC PP, CBC Grade School, 8-4-4). They're pre-configured but can be renamed.</li>
                    <li><strong>Grades</strong> are the classes/standards within each level (e.g., PP1, PP2, Grade 1, Form 1). Their numeric order determines promotion sequence.</li>
                    <li>To add a grade, select an academic level and fill in the code, display name, and numeric order.</li>
                </ul>
            </InfoGuide>

            <div className="card col-span-1 lg:col-span-1">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Academic Levels</h3>
                <p className="text-xs text-muted-foreground mb-4">Kenya&apos;s education curricula</p>
                <div className="overflow-x-auto">
                    <table className="data-table w-full sm:whitespace-nowrap">
                        <thead><tr><th>Code</th><th>Name</th></tr></thead>
                        <tbody>
                            {academicLevels.map(lvl => (
                                <tr key={lvl.id}>
                                    <td className="font-mono text-sm font-bold">{lvl.code}</td>
                                    <td>{lvl.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="card col-span-1 lg:col-span-2">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-2">Grades / Classes</h3>
                <div className="overflow-x-auto">
                    <table className="data-table w-full sm:whitespace-nowrap">
                        <thead><tr><th>Code</th><th>Display Name</th><th>Curriculum</th></tr></thead>
                        <tbody>
                            {grades.map(gr => (
                                <tr key={gr.id}>
                                    <td className="font-mono text-sm">{gr.code}</td>
                                    <td className="font-medium">{gr.name_display}</td>
                                    <td className="text-muted-foreground text-sm">
                                        {academicLevels.find(l => l.id === gr.academic_level_id)?.code || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
