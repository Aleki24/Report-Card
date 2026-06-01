"use client";

import React from 'react';
import { toast } from 'sonner';

interface SchoolFormProps {
  school: { name: string; address: string; phone: string; email: string; logo_url?: string; teacher_invite_code?: string; student_invite_code?: string };
  setSchool: React.Dispatch<React.SetStateAction<any>>;
}

export function SchoolForm({ school, setSchool }: SchoolFormProps) {
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo file MUST be less than 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setSchool((prev: any) => ({ ...prev, logo_url: event.target?.result as string })); };
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
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-accent)] file:text-white hover:file:bg-blue-600 transition-colors" />
          <p className="text-xs text-muted-foreground mt-2">Recommended: Square image, max 2MB. Background should be transparent (PNG).</p>
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">School Name *</label>
        <input className="input-field w-full" value={school.name} onChange={e => setSchool((prev: any) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Sunrise Academy" required />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Address</label>
        <input className="input-field w-full" value={school.address} onChange={e => setSchool((prev: any) => ({ ...prev, address: e.target.value }))} placeholder="e.g. 123 School Road, Nairobi" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Phone</label>
          <input className="input-field w-full" value={school.phone} onChange={e => setSchool((prev: any) => ({ ...prev, phone: e.target.value }))} placeholder="e.g. +254 700 000000" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Email</label>
          <input className="input-field w-full" type="email" value={school.email} onChange={e => setSchool((prev: any) => ({ ...prev, email: e.target.value }))} placeholder="e.g. info@school.com" />
        </div>
      </div>
      
      {/* Invite Codes Section */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <span>🔗</span> Invite Codes
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Share these codes with teachers and students so they can join your school during signup.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <label className="block text-xs font-semibold text-emerald-600 mb-1">Teacher Invite Code</label>
            <input 
              className="w-full bg-transparent font-mono text-sm tracking-wider outline-none text-foreground" 
              readOnly 
              value={school.teacher_invite_code || 'Not generated yet'} 
              onClick={e => (e.target as HTMLInputElement).select()}
            />
          </div>
          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <label className="block text-xs font-semibold text-blue-600 mb-1">Student Invite Code</label>
            <input 
              className="w-full bg-transparent font-mono text-sm tracking-wider outline-none text-foreground" 
              readOnly 
              value={school.student_invite_code || 'Not generated yet'} 
              onClick={e => (e.target as HTMLInputElement).select()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
