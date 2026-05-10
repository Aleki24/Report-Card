"use client";

import React from 'react';

interface InfoGuideProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function InfoGuide({ title, children, className = '' }: InfoGuideProps) {
  return (
    <div className={`my-8 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-8 rounded-xl flex items-start gap-5 leading-relaxed tracking-wide ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      <div className="text-sm">
        <h3 className="font-semibold mb-2 text-base">{title}</h3>
        {children}
      </div>
    </div>
  );
}
