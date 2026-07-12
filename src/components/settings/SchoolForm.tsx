"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';

interface SchoolShape {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url?: string;
  teacher_invite_code?: string;
  student_invite_code?: string;
}

interface SchoolFormProps {
  school: SchoolShape;
  setSchool: React.Dispatch<React.SetStateAction<SchoolShape>>;
}

function InviteCodeCard({ label, code, tone }: { label: string; code?: string; tone: 'good' | 'info' }) {
  const [copied, setCopied] = useState(false);
  const token = tone === 'good' ? 'var(--viz-good)' : 'var(--viz-info)';
  const has = Boolean(code);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy — select the code and copy manually.');
    }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${token} 30%, transparent)`,
        background: `color-mix(in srgb, ${token} 7%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs font-semibold" style={{ color: token }}>{label}</label>
        <button
          type="button"
          onClick={copy}
          disabled={!has}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-foreground/5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: token }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <input
        className="w-full bg-transparent font-mono text-base tracking-widest outline-none text-foreground"
        readOnly
        value={code || 'Not generated yet'}
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
    </div>
  );
}

export function SchoolForm({ school, setSchool }: SchoolFormProps) {
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo file MUST be less than 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setSchool((prev) => ({ ...prev, logo_url: event.target?.result as string })); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 mb-6">
        <div className="shrink-0">
          {school.logo_url ? (
            <img src={school.logo_url} alt="School Logo" className="w-24 h-24 rounded-lg object-contain bg-muted border border-border" />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center border border-border text-3xl">🏫</div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold mb-2">School Logo</label>
          <input type="file" accept="image/*" onChange={handleLogoUpload}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer transition-colors" />
          <p className="text-xs text-muted-foreground mt-2">Recommended: Square image, max 2MB. Background should be transparent (PNG).</p>
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">School Name *</label>
        <input className="input-field w-full" value={school.name} onChange={e => setSchool((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Sunrise Academy" required />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Address</label>
        <input className="input-field w-full" value={school.address} onChange={e => setSchool((prev) => ({ ...prev, address: e.target.value }))} placeholder="e.g. 123 School Road, Nairobi" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Phone</label>
          <input className="input-field w-full" value={school.phone} onChange={e => setSchool((prev) => ({ ...prev, phone: e.target.value }))} placeholder="e.g. +254 700 000000" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Email</label>
          <input className="input-field w-full" type="email" value={school.email} onChange={e => setSchool((prev) => ({ ...prev, email: e.target.value }))} placeholder="e.g. info@school.com" />
        </div>
      </div>

      {/* Invite Codes */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-sm font-bold mb-1 flex items-center gap-2">🔗 Invite Codes</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Share these codes with teachers and students so they can join your school during signup.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InviteCodeCard label="Teacher Invite Code" code={school.teacher_invite_code} tone="good" />
          <InviteCodeCard label="Student Invite Code" code={school.student_invite_code} tone="info" />
        </div>
      </div>
    </div>
  );
}
