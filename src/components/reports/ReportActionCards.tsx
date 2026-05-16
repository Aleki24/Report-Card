"use client";

import React from 'react';

interface ReportActionCardsProps {
  isConfigured: boolean;
  generating: boolean;
  generatingMarkSheet: boolean;
  onSelectStudent: () => void;
  onBulkGenerate: () => void;
  onTermComparison: () => void;
  onMarkSheet: () => void;
  onSMS: () => void;
}

export function ReportActionCards({
  isConfigured, generating, generatingMarkSheet,
  onSelectStudent, onBulkGenerate, onTermComparison, onMarkSheet, onSMS,
}: ReportActionCardsProps) {
  const disabled = !isConfigured;
  const disabledTitle = disabled ? "Please configure the Report Settings above first" : "";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      <div className={`card text-center p-8 flex flex-col h-full ${disabled ? 'opacity-50' : ''}`}>
        <img src="/images/dashboard_report_icon.png" alt="Report" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Individual Report</h3>
        <p className="text-sm text-muted-foreground mb-6 flex-grow">Generate a single student report card.</p>
        <button className="btn-secondary w-full justify-center disabled:cursor-not-allowed" onClick={onSelectStudent} disabled={disabled} title={disabledTitle}>Select Student →</button>
      </div>

      <div className={`card text-center p-8 flex flex-col h-full ${disabled ? 'opacity-50' : ''}`}>
        <img src="/images/dashboard_report_icon.png" alt="Empty" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Bulk Class Reports</h3>
        <p className="text-sm text-muted-foreground mb-6 flex-grow">Generate and download all reports at once.</p>
        <button className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed" onClick={onBulkGenerate} disabled={disabled || generating} title={disabledTitle}>{generating ? 'Processing...' : 'Generate & Download →'}</button>
      </div>

      <div className="card text-center p-8 flex flex-col h-full">
        <img src="/images/dashboard_comparison_icon.png" alt="Stats" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Term Comparison</h3>
        <p className="text-sm text-muted-foreground mb-6 flex-grow">Compare performance across multiple terms.</p>
        <button className="btn-secondary w-full justify-center" onClick={onTermComparison} suppressHydrationWarning>Compare Terms →</button>
      </div>

      <div className={`card text-center p-8 flex flex-col h-full ${disabled ? 'opacity-50' : ''}`}>
        <img src="/images/dashboard_marks_icon.png" alt="Result" className="mb-4" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">Class Mark Sheet</h3>
        <p className="text-sm text-muted-foreground mb-6 flex-grow">Ranked mark sheet with subject scores for the entire class.</p>
        <button className="btn-secondary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed" onClick={onMarkSheet} disabled={disabled || generatingMarkSheet} title={disabledTitle}>{generatingMarkSheet ? 'Processing...' : 'Generate Mark Sheet →'}</button>
      </div>

      <div className={`card text-center p-8 flex flex-col h-full ${disabled ? 'opacity-50' : ''}`}>
        <div className="mb-4 text-4xl">📱</div>
        <h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-2">SMS Results to Parents</h3>
        <p className="text-sm text-muted-foreground mb-6 flex-grow">Send student results to parents/guardians via SMS.</p>
        <button className="btn-secondary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed" onClick={onSMS} disabled={disabled} title={disabledTitle}>Send SMS →</button>
      </div>
    </div>
  );
}
