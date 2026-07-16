"use client";

import React from 'react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

interface NotifyStatus { sms: boolean; email: boolean }

function NotifyBanner({ notified }: { notified?: NotifyStatus | null }) {
  if (!notified) return null;
  if (notified.sms || notified.email) {
    const channels = [notified.sms && 'SMS', notified.email && 'email'].filter(Boolean).join(' and ');
    return (
      <p className="text-xs text-emerald-600 mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md p-2">
        ✓ Invite code sent via {channels}.
      </p>
    );
  }
  return (
    <p className="text-xs text-amber-600 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
      Could not send the code automatically — please share it manually.
    </p>
  );
}

interface InviteResultModalProps {
  invitedName: string;
  invitedUsername: string;
  invitedCode: string; // Renamed from invitedPassword
  notified?: NotifyStatus | null;
  onClose: () => void;
}

export function InviteResultModal({ invitedName, invitedUsername, invitedCode, notified, onClose }: InviteResultModalProps) {
  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-md">
      <div className="text-center">
        <img src="https://em-content.zobj.net/source/apple/354/check-mark-button_2705.png" alt="Success" className="w-16 h-16 object-contain mb-4 mx-auto" />
        <h2 className="text-lg font-bold font-sans mb-2">User Added!</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Please provide these activation details to <strong>{invitedName}</strong>:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
          <div className="bg-popover border border-border rounded-md p-4">
            <div className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Username</div>
            <div className="text-lg font-semibold font-mono text-primary">{invitedUsername}</div>
          </div>
          <div className="bg-popover border border-border rounded-md p-4">
            <div className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Invite Code</div>
            <div className="text-sm font-medium font-mono text-foreground uppercase tracking-widest">{invitedCode}</div>
          </div>
        </div>
        <NotifyBanner notified={notified} />
        <p className="text-xs text-muted-foreground mb-6">
          The user must activate their account by going to <strong>/activate</strong> and setting their own password.
        </p>
        <button className="btn-primary w-full" onClick={onClose}>Done</button>
      </div>
    </ModalOverlay>
  );
}

interface ResetPasswordResultModalProps {
  inviteCode: string; // Renamed from password
  notified?: NotifyStatus | null;
  onClose: () => void;
}

export function ResetPasswordResultModal({ inviteCode, notified, onClose }: ResetPasswordResultModalProps) {
  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-sm">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-primary/15">
          <span className="text-3xl">🔑</span>
        </div>
        <h2 className="text-lg font-bold font-sans mb-2">Account Reset</h2>
        <p className="text-sm text-muted-foreground mb-4">A new invite code was generated for this user:</p>
        <div className="bg-muted border rounded-lg p-4 mb-4">
          <code className="text-xl font-mono font-bold tracking-widest uppercase text-primary">{inviteCode}</code>
        </div>
        <NotifyBanner notified={notified} />
        <p className="text-xs text-muted-foreground mb-4">Share this code with the user. They must go to <strong>/activate</strong> to set a new password.</p>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </ModalOverlay>
  );
}
