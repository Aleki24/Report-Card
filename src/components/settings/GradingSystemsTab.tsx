"use client";

import React from 'react';
import { InfoGuide } from '@/components/ui/InfoGuide';

interface AcademicLevel { id: string; code: string; name: string; }
interface GradingSystem { id: string; name: string; description: string | null; academic_level_id: string; }
interface GradingScale { id: string; grading_system_id: string; min_percentage: number; max_percentage: number; symbol: string; label: string; points: number | null; order_index: number; }

interface GradingSystemsTabProps {
    academicLevels: AcademicLevel[];
    gradingSystems: GradingSystem[];
    gradingScales: GradingScale[];
}

export function GradingSystemsTab({ academicLevels, gradingSystems, gradingScales }: GradingSystemsTabProps) {
    return (
        <div className="lg:col-span-3 flex flex-col gap-6">
            <InfoGuide title="Understanding Grading Systems:">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li>Grading systems and scales are pre-configured based on national standards (e.g., KNEC standard 12-point scale, CBC scale).</li>
                    <li>These grading scales are automatically applied when teachers enter exam scores.</li>
                </ul>
            </InfoGuide>

            {gradingSystems.length > 0 ? gradingSystems.map(gs => {
                const levelName = academicLevels.find(l => l.id === gs.academic_level_id)?.name || '';
                const scales = gradingScales.filter(sc => sc.grading_system_id === gs.id);
                return (
                    <div key={gs.id} className="card">
                        <h3 className="font-bold text-lg mb-1 font-[family-name:var(--font-display)]">{gs.name}</h3>
                        <p className="text-xs text-muted-foreground mb-4">{levelName}{gs.description ? ` · ${gs.description}` : ''}</p>
                        {scales.length > 0 && (
                            <div className="overflow-x-auto border border-border rounded-lg">
                                <table className="data-table w-full text-left sm:whitespace-nowrap">
                                    <thead className="bg-muted border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Symbol</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Points</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Min %</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Max %</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {scales.map(sc => (
                                            <tr key={sc.id} className="hover:bg-muted transition-colors">
                                                <td className="px-4 py-3 font-bold">{sc.symbol}</td>
                                                <td className="px-4 py-3 text-sm">{sc.points ?? '—'}</td>
                                                <td className="px-4 py-3 text-sm font-mono">{sc.min_percentage}%</td>
                                                <td className="px-4 py-3 text-sm font-mono">{sc.max_percentage}%</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">{sc.label}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            }) : (
                <div className="card text-center p-8">
                    <img src="https://em-content.zobj.net/source/apple/354/triangular-ruler_1f4d0.png" alt="Settings" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    <p className="text-sm text-muted-foreground">Grading systems have not been configured yet.</p>
                </div>
            )}
        </div>
    );
}
