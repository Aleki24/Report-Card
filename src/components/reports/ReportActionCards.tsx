"use client";

import React from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { FileText, Layers, BarChart3, Table2, MessageSquare } from 'lucide-react';

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

  const actions = [
    {
      icon: Layers,
      title: 'Bulk Class Reports',
      description: 'Generate and download all reports at once.',
      button: (
        <Button variant="primary" size="sm" className="w-full" onClick={onBulkGenerate} disabled={disabled || generating} title={disabledTitle}>
          {generating ? 'Processing...' : 'Generate & Download'}
        </Button>
      ),
    },
    {
      icon: FileText,
      title: 'Individual Report',
      description: 'Generate a single student report card.',
      button: (
        <Button variant="secondary" size="sm" className="w-full" onClick={onSelectStudent} disabled={disabled} title={disabledTitle}>
          Select Student
        </Button>
      ),
    },
    {
      icon: Table2,
      title: 'Class Mark Sheet',
      description: 'Ranked mark sheet with subject scores for the entire class.',
      button: (
        <Button variant="secondary" size="sm" className="w-full" onClick={onMarkSheet} disabled={disabled || generatingMarkSheet} title={disabledTitle}>
          {generatingMarkSheet ? 'Processing...' : 'Generate Mark Sheet'}
        </Button>
      ),
    },
    {
      icon: MessageSquare,
      title: 'SMS Results to Parents',
      description: 'Send student results to parents/guardians via SMS.',
      button: (
        <Button variant="secondary" size="sm" className="w-full" onClick={onSMS} disabled={disabled} title={disabledTitle}>
          Send SMS
        </Button>
      ),
    },
    {
      icon: BarChart3,
      title: 'Term Comparison',
      description: 'Compare performance across multiple terms.',
      button: (
        <Button variant="secondary" size="sm" className="w-full" onClick={onTermComparison}>
          Compare Terms
        </Button>
      ),
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-[15px] font-semibold font-display">② Generate &amp; Share</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {actions.map((action, i) => (
          <Card key={i} className={`${disabled && action.button.props.disabled !== undefined ? 'opacity-50' : ''}`}>
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12">
                <action.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-0.5">{action.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{action.description}</p>
              </div>
              {action.button}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
