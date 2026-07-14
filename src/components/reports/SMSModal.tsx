"use client";

import React from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { MessageSquare, Search, Loader2, CheckCircle, XCircle, Send, AlertTriangle } from 'lucide-react';

interface SMSStudent {
  id: string;
  admission_number: string;
  guardian_phone: string | null;
  guardian_name: string | null;
  users: { first_name: string; last_name: string } | null;
  selected: boolean;
}

interface SMSModalProps {
  onClose: () => void;
  smsStudents: SMSStudent[];
  filteredSMSStudents: SMSStudent[];
  loadingSMSStudents: boolean;
  smsSearch: string;
  setSmsSearch: (v: string) => void;
  smsSelectedCount: number;
  smsMissingPhoneCount: number;
  sendingSMS: boolean;
  smsResult: { sent: number; failed: number; skipped: number; failureReasons: string[] } | null;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSend: () => void;
  messagePreview: string;
}

export function SMSModal({
  onClose, smsStudents, filteredSMSStudents, loadingSMSStudents,
  smsSearch, setSmsSearch, smsSelectedCount, smsMissingPhoneCount,
  sendingSMS, smsResult, onToggle, onSelectAll, onDeselectAll, onSend, messagePreview,
}: SMSModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-bold font-display">SMS Results to Parents</h2>
          </div>
          <Button variant="secondary" size="xs" onClick={onClose}><XCircle className="w-3 h-3" /> Close</Button>
        </div>

        <div className="p-5">
          <div className="p-3 rounded-lg bg-muted border border-border mb-4 text-xs">
            <p className="font-medium mb-0.5">How it works:</p>
            <p className="text-muted-foreground">Select students below to send their term results summary to their guardian&apos;s phone via SMS.</p>
            {smsMissingPhoneCount > 0 && (
              <p className="mt-1.5 text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {smsMissingPhoneCount} student{smsMissingPhoneCount > 1 ? 's' : ''} missing guardian phone number.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="flex items-center input-field overflow-hidden px-0 flex-1">
              <span className="flex items-center justify-center pl-2.5 text-muted-foreground shrink-0">
                <Search size={16} />
              </span>
              <input className="flex-1 border-none outline-none bg-transparent py-1.5 pr-3 text-xs" placeholder="Search by name or admission number..." value={smsSearch} onChange={e => setSmsSearch(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" size="xs" onClick={onSelectAll}>Select All</Button>
              <Button variant="secondary" size="xs" onClick={onDeselectAll}>Deselect All</Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loadingSMSStudents ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading students...</p>
            </div>
          ) : filteredSMSStudents.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {smsSearch ? 'No students match your search.' : 'No students found in this class.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1 pb-5">
              {filteredSMSStudents.map(s => {
                const name = `${s.users?.first_name || '—'} ${s.users?.last_name || ''}`;
                const hasPhone = !!s.guardian_phone;
                return (
                  <label key={s.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${s.selected ? 'bg-primary/5' : 'hover:bg-muted'} ${!hasPhone ? 'opacity-50' : ''}`}>
                    <input type="checkbox" checked={s.selected} disabled={!hasPhone} onChange={() => onToggle(s.id)} className="accent-primary w-4 h-4" />
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {(s.users?.first_name?.[0] || '?').toUpperCase()}{(s.users?.last_name?.[0] || '').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{s.admission_number}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {hasPhone ? <span className="text-[11px] text-emerald-500 font-mono">{s.guardian_phone}</span> : <span className="text-[11px] text-red-400">No phone</span>}
                    </div>
                    {s.guardian_name && hasPhone && (
                      <div className="text-[11px] text-muted-foreground hidden md:block truncate shrink-0" style={{ maxWidth: 100 }}>{s.guardian_name}</div>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border space-y-3">
          {smsSelectedCount > 0 && (
            <div className="p-3 rounded-lg bg-muted border border-border text-xs font-mono whitespace-pre-wrap">
              <div className="text-muted-foreground mb-1 font-sans text-[11px] font-semibold">Message Preview:</div>
              {messagePreview}
            </div>
          )}

          {smsResult && (
            <div className={`p-3 rounded-lg text-xs font-medium border ${smsResult.failed > 0 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
              <CheckCircle className="w-3 h-3 inline mr-1" /> Sent: <strong>{smsResult.sent}</strong> &nbsp;|&nbsp; <XCircle className="w-3 h-3 inline mr-1" /> Failed: <strong>{smsResult.failed}</strong>
              {smsResult.skipped > 0 && <> &nbsp;|&nbsp; <AlertTriangle className="w-3 h-3 inline mr-1" /> Skipped: <strong>{smsResult.skipped}</strong></>}
              {smsResult.failureReasons.length > 0 && (
                <ul className="mt-2 list-disc pl-4 font-normal opacity-90">
                  {smsResult.failureReasons.map((reason, i) => <li key={i}>{reason}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {smsSelectedCount} student{smsSelectedCount !== 1 ? 's' : ''} selected
              {smsSelectedCount > 0 && <span className="ml-1">(~KES {(smsSelectedCount * 0.8).toFixed(1)} est.)</span>}
            </span>
            <Button variant="primary" size="sm" onClick={onSend} disabled={sendingSMS || smsSelectedCount === 0}>
              {sendingSMS ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Send SMS to {smsSelectedCount} Parent{smsSelectedCount !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
