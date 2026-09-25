"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Download, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui';
import type { CreatedCredential } from './peopleTypes';

const fullName = (c: CreatedCredential) => `${c.first_name} ${c.last_name}`.trim();

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

function toCsv(rows: readonly CreatedCredential[]): string {
  return ['Name,Username,Invite code', ...rows.map(c => [fullName(c), c.username, c.invite_code.toUpperCase()].map(csvCell).join(','))].join('\n');
}

/**
 * Invite codes for students just added. They are shown once, so the admin
 * can copy them or save a CSV before closing.
 */
export function InviteCodesDialog({ credentials, onClose }: { credentials: readonly CreatedCredential[] | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!credentials || credentials.length === 0) return null;

  const copyAll = async () => {
    const text = credentials.map(c => `${fullName(c)}\t${c.username}\t${c.invite_code.toUpperCase()}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Invite codes copied');
    } catch {
      toast.error("Couldn't copy — download the CSV instead.");
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(credentials)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'student-invite-codes.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const many = credentials.length > 1;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={many ? `${credentials.length} invite codes` : 'Invite code'}
      size="lg"
      footer={<>
        <button type="button" className="btn-secondary" onClick={download}><Download className="size-4" aria-hidden />CSV</button>
        <button type="button" className="btn-secondary" onClick={copyAll}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied ? 'Copied' : 'Copy all'}
        </button>
        <button type="button" className="btn-primary" onClick={onClose}>Done</button>
      </>}
    >
      <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {many ? 'Each student uses their code' : 'The student uses this code'} at <strong>/activate</strong> to set a password.
          {' '}<strong>{many ? "These won't" : "It won't"} be shown again</strong> — copy or download {many ? 'them' : 'it'} now.
        </span>
      </p>
      <ul className="max-h-[50vh] divide-y divide-border/60 overflow-y-auto rounded-xl border border-border">
        {credentials.map(c => (
          <li key={c.username} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{fullName(c)}</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">{c.username}</span>
            </span>
            <span className="rounded-lg bg-muted px-2.5 py-1 font-mono text-sm font-semibold tracking-widest uppercase">{c.invite_code}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
