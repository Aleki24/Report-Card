"use client";

import React from 'react';
import { useDialogBehavior } from '@/hooks/useDialogBehavior';
import { cn } from '@/lib/utils';

interface ModalOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
  className?: string;
  /** Accessible name when the content has no visible heading to point at. */
  ariaLabel?: string;
}

/**
 * A bare dialog panel for content that lays out its own heading and actions.
 * Rendered only while open, so the dialog behaviour is always on.
 */
export function ModalOverlay({ children, onClose, maxWidth = 'max-w-lg', className, ariaLabel }: ModalOverlayProps) {
  const { panelRef, backdropProps } = useDialogBehavior(true, onClose);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      {...backdropProps}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        // .card only pads itself on narrow screens; dialogs need it at every width.
        className={cn('card w-full max-h-[90vh] overflow-y-auto p-5 outline-none animate-fade-in sm:p-6', maxWidth, className)}
      >
        {children}
      </div>
    </div>
  );
}
