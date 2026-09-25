"use client";

import React, { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { activationUrl } from '@/lib/activation-link';

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

/**
 * Hands the code over as a link that fills itself in on /activate, so the
 * person never has to type it — copy it anywhere, or send it on WhatsApp.
 */
function ShareActivation({ code, name }: { code: string; name?: string }) {
  const [copied, setCopied] = useState(false);
  const link = activationUrl(code, typeof window === 'undefined' ? '' : window.location.origin);
  const message = `${name ? `Hi ${name}, s` : 'S'}et up your Skulbase account here: ${link} (invite code ${code})`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Activation link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select the link and copy it manually.');
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 text-left">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activation link</span>
      <p className="break-all rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground select-all">{link}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={copyLink} className="btn-secondary inline-flex items-center justify-center gap-2">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex items-center justify-center gap-2 no-underline"
        >
          <MessageCircle className="size-4" aria-hidden />
          Send on WhatsApp
        </a>
      </div>
    </div>
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
        <ShareActivation code={invitedCode} name={invitedName} />
        <p className="text-xs text-muted-foreground mb-6">
          Opening the link fills the code in; they then choose a password and are signed in straight away.
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
        <ShareActivation code={inviteCode} />
        <p className="text-xs text-muted-foreground mb-4">Share the link or code with the user. Opening it lets them set a new password and signs them in.</p>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </ModalOverlay>
  );
}
