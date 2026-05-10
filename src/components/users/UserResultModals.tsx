"use client";

import React from 'react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

interface InviteResultModalProps {
  invitedName: string;
  invitedUsername: string;
  invitedPassword: string;
  onClose: () => void;
}

export function InviteResultModal({ invitedName, invitedUsername, invitedPassword, onClose }: InviteResultModalProps) {
  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-md">
      <div className="text-center">
        <img src="https://em-content.zobj.net/source/apple/354/check-mark-button_2705.png" alt="Success" className="mb-4" style={{ width: 64, height: 64, objectFit: 'contain' }} />
        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">User Added!</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Please provide these login details to <strong>{invitedName}</strong>:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
          <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
            <div className="text-xs text-[var(--color-text-muted)] mb-1 font-semibold uppercase tracking-wider">Username</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-accent)' }}>{invitedUsername}</div>
          </div>
          <div style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
            <div className="text-xs text-[var(--color-text-muted)] mb-1 font-semibold uppercase tracking-wider">Password</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{invitedPassword}</div>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mb-6">
          The user can log in immediately at <strong>/login</strong>. It&apos;s recommended they update their password after their first login.
        </p>
        <button className="btn-primary w-full" onClick={onClose}>Done</button>
      </div>
    </ModalOverlay>
  );
}

interface ResetPasswordResultModalProps {
  password: string;
  onClose: () => void;
}

export function ResetPasswordResultModal({ password, onClose }: ResetPasswordResultModalProps) {
  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-sm">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
          <span className="text-3xl">🔑</span>
        </div>
        <h2 className="text-lg font-bold font-[family-name:var(--font-display)] mb-2">Password Reset</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>New password for this user:</p>
        <div className="bg-[var(--color-surface-raised)] border rounded-lg p-4 mb-4">
          <code className="text-xl font-mono font-bold" style={{ color: 'var(--color-success)' }}>{password}</code>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Share this password with the user securely.</p>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </ModalOverlay>
  );
}
