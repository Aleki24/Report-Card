"use client";

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import EmptyState from '@/components/dashboard/EmptyState';

/**
 * A section that could not load, with a way to try again. Shown instead of
 * the empty state, which would tell the user there is nothing when the
 * request simply failed.
 */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-dashed border-border bg-card">
      <EmptyState
        hue="rose"
        icon={<AlertTriangle className="size-6" />}
        title={title}
        description={message}
        action={<button type="button" className="btn-primary" onClick={onRetry}><RotateCcw className="size-4" aria-hidden="true" />Try again</button>}
      />
    </div>
  );
}
