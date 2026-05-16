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
            <InfoGuide title="How to setup Academic Structure:" className="col-span-1 lg:col-span-3">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li>Kenya&apos;s educational curricula and class grades are pre-configured for your convenience.</li>
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
