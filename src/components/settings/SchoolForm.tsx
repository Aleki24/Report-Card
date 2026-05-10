"use client";

import React from 'react';

interface SchoolFormProps {
  school: { name: string; address: string; phone: string; email: string; logo_url?: string };
  setSchool: React.Dispatch<React.SetStateAction<any>>;
}

export function SchoolForm({ school, setSchool }: SchoolFormProps) {
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo file MUST be less than 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setSchool((prev: any) => ({ ...prev, logo_url: event.target?.result as string })); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 mb-6">
        <div className="shrink-0">
          {school.logo_url ? (
            <img src={school.logo_url} alt="School Logo" className="w-24 h-24 rounded-lg object-contain bg-[var(--color-surface-raised)] border border-[var(--color-border)]" />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-[var(--color-surface-raised)] flex items-center justify-center border border-[var(--color-border)] text-3xl">🏫</div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold mb-2">School Logo</label>
          <input type="file" accept="image/*" onChange={handleLogoUpload}
            className="block w-full text-sm text-[var(--color-text-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-accent)] file:text-white hover:file:bg-blue-600 transition-colors" />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">Recommended: Square image, max 2MB. Background should be transparent (PNG).</p>
        </div>
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1">School Name *</label>
        <input className="input-field w-full" value={school.name} onChange={e => setSchool((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Sunrise Academy" required />
      </div>
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1">Address</label>
        <input className="input-field w-full" value={school.address} onChange={e => setSchool((prev: any) => ({ ...prev, address: e.target.value }))} placeholder="e.g. 123 School Road, Nairobi" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Phone</label>
          <input className="input-field w-full" value={school.phone} onChange={e => setSchool((prev: any) => ({ ...prev, phone: e.target.value }))} placeholder="e.g. +254 700 000000" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Email</label>
          <input className="input-field w-full" type="email" value={school.email} onChange={e => setSchool((prev: any) => ({ ...prev, email: e.target.value }))} placeholder="e.g. info@school.com" />
        </div>
      </div>
    </div>
  );
}
