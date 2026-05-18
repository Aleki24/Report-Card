"use client";

import React, { useState } from 'react';

interface InfoGuideProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function InfoGuide({ title, children, className = '' }: InfoGuideProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-glow)] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span className="flex-1">{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}
