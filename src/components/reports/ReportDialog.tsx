"use client";

import React from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import type { Tone } from '@/components/ui/tones';
import { cn } from '@/lib/utils';

interface ReportDialogProps {
    title: string;
    subtitle?: React.ReactNode;
    icon: LucideIcon;
    tone: Tone;
    onClose: () => void;
    /** Pinned under the header: search, filters. */
    toolbar?: React.ReactNode;
    /** Pinned at the bottom: the dialog's actions. */
    footer?: React.ReactNode;
    maxWidth?: string;
    children: React.ReactNode;
}

/**
 * The Report Cards page's dialogs: a fixed header and footer around a body
 * that scrolls, so a long class list never pushes the actions off screen.
 */
export function ReportDialog({ title, subtitle, icon: Icon, tone, onClose, toolbar, footer, maxWidth = 'max-w-lg', children }: ReportDialogProps) {
    return (
        <ModalOverlay onClose={onClose} maxWidth={maxWidth} ariaLabel={title} className="flex flex-col overflow-hidden p-0 sm:p-0">
            <header className="flex shrink-0 items-start gap-3 border-b border-border/70 p-4 sm:p-5">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone.tile)} aria-hidden><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-display text-base font-bold leading-tight sm:text-lg">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="size-4" aria-hidden />
                </button>
            </header>
            {toolbar && <div className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-5">{toolbar}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">{children}</div>
            {footer && <footer className="shrink-0 border-t border-border/70 p-4 sm:p-5">{footer}</footer>}
        </ModalOverlay>
    );
}

/** A learner's initials in a round chip. */
export function LearnerAvatar({ initials }: { initials: string }) {
    return (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary" aria-hidden>
            {initials}
        </span>
    );
}
