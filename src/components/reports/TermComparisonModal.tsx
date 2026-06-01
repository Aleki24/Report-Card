"use client";

import React, { useState } from 'react';
import { Card, CardContent, Button, Select } from '@/components/ui';
import { BarChart3, X, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface TermComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    academicYears: any[];
    terms: any[];
    gradeStreams: any[];
}

export function TermComparisonModal({ isOpen, onClose, academicYears, terms, gradeStreams }: TermComparisonModalProps) {
    const [loading, setLoading] = useState(false);
    const [selectedStream, setSelectedStream] = useState('');

    const [term1Year, setTerm1Year] = useState('');
    const [term1Term, setTerm1Term] = useState('');

    const [term2Year, setTerm2Year] = useState('');
    const [term2Term, setTerm2Term] = useState('');

    const [results, setResults] = useState<any>(null);

    const handleCompare = async () => {
        if (!selectedStream || !term1Year || !term1Term || !term2Year || !term2Term) {
            toast.error("Please select all fields.");
            return;
        }
        setLoading(true);

        try {
            const mRes = await fetch(`/api/school/exam-marks/stream?stream_id=${selectedStream}`);
            if (!mRes.ok) throw new Error('Failed to fetch marks');
            const { data: marks } = await mRes.json();

            if (!marks || marks.length === 0) {
                toast.error("No marks found for the selected grade stream.");
                setLoading(false);
                return;
            }

            let t1Sum = 0, t1Count = 0;
            let t2Sum = 0, t2Count = 0;

            marks.forEach((m: any) => {
                const exam = m.exams;
                if (!exam) return;
                if (exam.term_id === term1Term && exam.academic_year_id === term1Year) {
                    t1Sum += Number(m.percentage);
                    t1Count++;
                } else if (exam.term_id === term2Term && exam.academic_year_id === term2Year) {
                    t2Sum += Number(m.percentage);
                    t2Count++;
                }
            });

            if (t1Count === 0 || t2Count === 0) {
                toast.error("Could not find marks for one or both of the selected terms.");
                setLoading(false);
                return;
            }

            const t1Avg = t1Count > 0 ? (t1Sum / t1Count) : 0;
            const t2Avg = t2Count > 0 ? (t2Sum / t2Count) : 0;
            const delta = t2Avg - t1Avg;

            setResults({
                term1Avg: String(Math.round(t1Avg)),
                term2Avg: String(Math.round(t2Avg)),
                delta: String(Math.round(delta)),
                improved: delta > 0,
                decreased: delta < 0
            });

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "An error occurred during comparison.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <Card className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-bold font-display">Compare Terms</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground"><X className="w-4 h-4" /></Button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <div className="mb-5">
                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Grade Stream</label>
                        <Select className="w-full h-9 text-sm" value={selectedStream} onChange={e => setSelectedStream(e.target.value)}>
                            <option value="">Select Stream...</option>
                            {gradeStreams.map((gs: any) => (
                                <option key={gs.id} value={gs.id}>{gs.full_name}</option>
                            ))}
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div className="p-4 rounded-lg border border-border bg-muted">
                            <h4 className="font-semibold text-sm mb-3">Base Term (Term 1)</h4>
                            <Select className="w-full h-9 text-sm mb-2" value={term1Year} onChange={e => setTerm1Year(e.target.value)}>
                                <option value="">Academic Year...</option>
                                {academicYears.map((ay: any) => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                            </Select>
                            <Select className="w-full h-9 text-sm" value={term1Term} onChange={e => setTerm1Term(e.target.value)}>
                                <option value="">Term...</option>
                                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                        </div>

                        <div className="p-4 rounded-lg border border-border bg-muted">
                            <h4 className="font-semibold text-sm mb-3">Comparison Term (Term 2)</h4>
                            <Select className="w-full h-9 text-sm mb-2" value={term2Year} onChange={e => setTerm2Year(e.target.value)}>
                                <option value="">Academic Year...</option>
                                {academicYears.map((ay: any) => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                            </Select>
                            <Select className="w-full h-9 text-sm" value={term2Term} onChange={e => setTerm2Term(e.target.value)}>
                                <option value="">Term...</option>
                                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                        </div>
                    </div>

                    <Button variant="primary" size="sm" className="w-full" onClick={handleCompare} disabled={loading}>
                        {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : 'Generate Comparison'}
                    </Button>

                    {results && (
                        <div className="mt-6 animate-in fade-in duration-200">
                            <h3 className="text-[11px] font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Results Overview</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-4 rounded-lg border border-border bg-card text-center">
                                    <div className="text-[11px] text-muted-foreground mb-1">Base Term</div>
                                    <div className="text-xl font-bold">{results.term1Avg}%</div>
                                </div>
                                <div className="p-4 rounded-lg border border-border bg-card text-center">
                                    <div className="text-[11px] text-muted-foreground mb-1">Comparison</div>
                                    <div className="text-xl font-bold">{results.term2Avg}%</div>
                                </div>
                                <div className={`p-4 rounded-lg border text-center ${results.improved ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : results.decreased ? 'border-red-500/20 bg-red-500/10 text-red-500' : 'border-border bg-card'}`}>
                                    <div className="text-[11px] opacity-80 mb-1">Delta</div>
                                    <div className="text-xl font-bold flex items-center justify-center gap-1">
                                        {results.improved ? <TrendingUp className="w-4 h-4" /> : results.decreased ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                        {results.improved ? '+' : ''}{results.delta}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
