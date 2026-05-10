"use client";

import React from 'react';

interface ProgressOverlayProps {
  message: string;
  current?: number;
  total?: number;
}

export function ProgressOverlay({ message, current = 0, total = 0 }: ProgressOverlayProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md p-8 text-center" style={{ animation: 'zoomIn 0.3s ease' }}>
        <h3 className="text-xl font-bold font-[family-name:var(--font-display)] mb-4">Processing Reports</h3>

        {total > 0 ? (
          <div className="w-full bg-[var(--color-border)] rounded-full h-3 mb-2 overflow-hidden mx-auto mt-6">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, (current / total) * 100)}%` }}
            />
          </div>
        ) : (
          <div className="flex justify-center my-6">
            <div className="w-8 h-8 rounded-full border-4 border-[var(--color-border)] border-t-blue-600 animate-spin"></div>
          </div>
        )}

        <p className="text-sm font-medium mt-4">{message}</p>
        {total > 0 && (
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{current} of {total} generated</p>
        )}
      </div>
    </div>
  );
}
