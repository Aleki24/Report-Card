"use client";

import React from 'react';

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
  smsResult: { sent: number; failed: number; skipped: number } | null;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card w-full max-w-2xl" style={{ animation: 'fadeIn .2s ease', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">📱 SMS Results to Parents</h2>
          <button className="btn-secondary text-xs py-1 px-3" onClick={onClose}>✕ Close</button>
        </div>

        <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}>
          <strong>How it works:</strong> Select students below to send their term results summary to their guardian&apos;s phone via SMS.
          {smsMissingPhoneCount > 0 && (
            <span className="block mt-1 text-amber-500">⚠ {smsMissingPhoneCount} student{smsMissingPhoneCount > 1 ? 's' : ''} missing guardian phone number.</span>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
          <input className="input-field flex-1" placeholder="Search by name or admission number..." value={smsSearch} onChange={e => setSmsSearch(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-1 px-3" onClick={onSelectAll}>Select All</button>
            <button className="btn-secondary text-xs py-1 px-3" onClick={onDeselectAll}>Deselect All</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 mb-4" style={{ maxHeight: '40vh' }}>
          {loadingSMSStudents ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 rounded-full border-3 border-[var(--color-border)] border-t-blue-600 animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-[var(--color-text-muted)]">Loading students…</p>
            </div>
          ) : filteredSMSStudents.length === 0 ? (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-6">
              {smsSearch ? 'No students match your search.' : 'No students found in this class.'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredSMSStudents.map(s => {
                const name = `${s.users?.first_name || '—'} ${s.users?.last_name || ''}`;
                const hasPhone = !!s.guardian_phone;
                return (
                  <label key={s.id} className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors cursor-pointer ${s.selected ? 'bg-blue-500/10' : 'hover:bg-[var(--color-surface-raised)]'} ${!hasPhone ? 'opacity-50' : ''}`}>
                    <input type="checkbox" checked={s.selected} disabled={!hasPhone} onChange={() => onToggle(s.id)} className="accent-blue-600 w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono">{s.admission_number}</div>
                    </div>
                    <div className="text-right">
                      {hasPhone ? <span className="text-xs text-green-500 font-mono">{s.guardian_phone}</span> : <span className="text-xs text-red-400">No phone</span>}
                    </div>
                    {s.guardian_name && hasPhone && (
                      <div className="text-xs text-[var(--color-text-muted)] hidden md:block" style={{ maxWidth: 100 }}>{s.guardian_name}</div>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {smsSelectedCount > 0 && (
          <div className="rounded-lg p-3 mb-4 text-xs font-mono" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', whiteSpace: 'pre-wrap' }}>
            <div className="text-[var(--color-text-muted)] mb-1 font-sans text-xs font-semibold">Message Preview:</div>
            {messagePreview}
          </div>
        )}

        {smsResult && (
          <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: smsResult.failed > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${smsResult.failed > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
            ✅ Sent: <strong>{smsResult.sent}</strong> &nbsp;|&nbsp; ❌ Failed: <strong>{smsResult.failed}</strong>
            {smsResult.skipped > 0 && <> &nbsp;|&nbsp; ⏭ Skipped: <strong>{smsResult.skipped}</strong></>}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-muted)]">
            {smsSelectedCount} student{smsSelectedCount !== 1 ? 's' : ''} selected
            {smsSelectedCount > 0 && <span className="text-xs ml-1">(~KES {(smsSelectedCount * 0.8).toFixed(1)} est.)</span>}
          </span>
          <button className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" onClick={onSend} disabled={sendingSMS || smsSelectedCount === 0}>
            {sendingSMS ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>Sending…</span>
            ) : (
              `📱 Send SMS to ${smsSelectedCount} Parent${smsSelectedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
