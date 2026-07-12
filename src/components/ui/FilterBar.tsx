import React from 'react';

/**
 * One filter row above the content it scopes (never per-card filters).
 * Horizontally scrollable below `md` so filters never wrap into a wall.
 */
export default function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card/90 p-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:p-3 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** A labeled slot inside FilterBar; keeps each control from shrinking on mobile. */
export function FilterField({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <label className="flex shrink-0 items-center gap-2">
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      {children}
    </label>
  );
}
