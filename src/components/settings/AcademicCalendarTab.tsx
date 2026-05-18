"use client";

import React from 'react';
import { InfoGuide } from '@/components/ui/InfoGuide';

interface AcademicYear { id: string; name: string; start_date: string; end_date: string; }
interface Term { id: string; academic_year_id: string; name: string; start_date: string; end_date: string; is_current: boolean; }

interface AcademicCalendarTabProps {
    academicYears: AcademicYear[];
    terms: Term[];
    selectedCalYearId: string;
    setSelectedCalYearId: (id: string) => void;
    calMsg: string;
    calSaving: boolean;
    newYear: { name: string; start_date: string; end_date: string };
    setNewYear: React.Dispatch<React.SetStateAction<{ name: string; start_date: string; end_date: string }>>;
    newTerm: { name: string; start_date: string; end_date: string };
    setNewTerm: React.Dispatch<React.SetStateAction<{ name: string; start_date: string; end_date: string }>>;
    onAddYear: (e: React.FormEvent) => void;
    onAddTerm: (e: React.FormEvent) => void;
    onDelete: (type: string, id: string) => void;
}

export function AcademicCalendarTab({
    academicYears, terms, selectedCalYearId, setSelectedCalYearId,
    calMsg, calSaving, newYear, setNewYear, newTerm, setNewTerm,
    onAddYear, onAddTerm, onDelete,
}: AcademicCalendarTabProps) {
    const calTerms = terms.filter(t => t.academic_year_id === selectedCalYearId);

    return (
        <div className="col-span-1 lg:col-span-3 flex flex-col gap-6">
            <InfoGuide title="How to manage the Academic Calendar:">
                <ul className="list-disc pl-5 space-y-2 opacity-90 mt-2">
                    <li><strong>Academic Years</strong> represent school years (e.g., 2026). Add one before creating terms.</li>
                    <li><strong>Terms</strong> belong to a year. Set clear start and end dates — overlapping terms will cause issues with exam and report assignments.</li>
                    <li>Mark one term as <strong>Current</strong> to indicate which term is active. Only one term should be current at a time.</li>
                    <li>To delete a year or term, make sure it isn&apos;t referenced by any exams or reports first.</li>
                </ul>
            </InfoGuide>

            {calMsg && (
                <div className={`p-3 rounded-md text-sm ${calMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                    {calMsg}
                </div>
            )}

            {/* Academic Years */}
            <div className="card">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">📅 Academic Years</h3>
                {academicYears.length > 0 ? (
                    <div className="overflow-x-auto border border-border rounded-lg mb-4">
                        <table className="data-table w-full text-left sm:whitespace-nowrap">
                            <thead className="bg-muted border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Year</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Start</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">End</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Terms</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {academicYears.map(y => (
                                    <tr key={y.id} className="hover:bg-muted transition-colors">
                                        <td className="px-4 py-3 font-bold">{y.name}</td>
                                        <td className="px-4 py-3 text-sm font-mono">{y.start_date}</td>
                                        <td className="px-4 py-3 text-sm font-mono">{y.end_date}</td>
                                        <td className="px-4 py-3 text-sm">{terms.filter(t => t.academic_year_id === y.id).length}</td>
                                        <td className="px-4 py-3">
                                            <button className="text-xs text-red-400 hover:text-red-300" onClick={() => onDelete('academic_year', y.id)} disabled={calSaving}>🗑</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground mb-4">No academic years yet. Add one below.</p>
                )}
                <form onSubmit={onAddYear} className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[120px]">
                        <label className="block text-xs text-muted-foreground mb-1">Year Name *</label>
                        <input className="input-field w-full" placeholder="e.g. 2026" value={newYear.name} onChange={e => setNewYear(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs text-muted-foreground mb-1">Start Date *</label>
                        <input type="date" className="input-field w-full" value={newYear.start_date} onChange={e => setNewYear(p => ({ ...p, start_date: e.target.value }))} />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs text-muted-foreground mb-1">End Date *</label>
                        <input type="date" className="input-field w-full" value={newYear.end_date} onChange={e => setNewYear(p => ({ ...p, end_date: e.target.value }))} />
                    </div>
                    <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving || !newYear.name.trim() || !newYear.start_date || !newYear.end_date}>
                        {calSaving ? '...' : '+ Add Year'}
                    </button>
                </form>
            </div>

            {/* Terms */}
            <div className="card">
                <h3 className="font-bold text-lg font-[family-name:var(--font-display)] mb-4">📋 Terms</h3>
                <div className="mb-4">
                    <label className="block text-xs text-muted-foreground mb-1">Select Academic Year</label>
                    {academicYears.length === 0 ? (
                        <p className="text-xs text-orange-400">Add an academic year first.</p>
                    ) : (
                        <select className="input-field w-full md:w-64" value={selectedCalYearId} onChange={e => setSelectedCalYearId(e.target.value)}>
                            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                    )}
                </div>
                {selectedCalYearId && (
                    <>
                        {calTerms.length > 0 ? (
                            <div className="overflow-x-auto border border-border rounded-lg mb-4">
                                <table className="data-table w-full text-left sm:whitespace-nowrap">
                                    <thead className="bg-muted border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Term</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Start</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">End</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Current</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {calTerms.map(t => (
                                            <tr key={t.id} className="hover:bg-muted transition-colors">
                                                <td className="px-4 py-3 font-medium">{t.name}</td>
                                                <td className="px-4 py-3 text-sm font-mono">{t.start_date}</td>
                                                <td className="px-4 py-3 text-sm font-mono">{t.end_date}</td>
                                                <td className="px-4 py-3 text-sm">{t.is_current ? '✅' : ''}</td>
                                                <td className="px-4 py-3">
                                                    <button className="text-xs text-red-400 hover:text-red-300" onClick={() => onDelete('term', t.id)} disabled={calSaving}>🗑</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mb-4">No terms for this year. Add one below.</p>
                        )}
                        <form onSubmit={onAddTerm} className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[120px]">
                                <label className="block text-xs text-muted-foreground mb-1">Term Name *</label>
                                <input className="input-field w-full" placeholder="e.g. Term 1" value={newTerm.name} onChange={e => setNewTerm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-xs text-muted-foreground mb-1">Start Date *</label>
                                <input type="date" className="input-field w-full" value={newTerm.start_date} onChange={e => setNewTerm(p => ({ ...p, start_date: e.target.value }))} />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-xs text-muted-foreground mb-1">End Date *</label>
                                <input type="date" className="input-field w-full" value={newTerm.end_date} onChange={e => setNewTerm(p => ({ ...p, end_date: e.target.value }))} />
                            </div>
                            <button type="submit" className="btn-primary whitespace-nowrap" disabled={calSaving || !newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date}>
                                {calSaving ? '...' : '+ Add Term'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
