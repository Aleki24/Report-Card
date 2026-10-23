'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, HelpCircle, Loader2, Trash2 } from 'lucide-react';
import { useDialogBehavior } from '@/hooks/useDialogBehavior';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
    const { panelRef, backdropProps } = useDialogBehavior(isOpen, onClose);
    const titleId = useId();

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-backdrop-in"
            {...backdropProps}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={`card w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto bg-card animate-modal-in p-5 outline-none hover:border-border/70 sm:p-6`}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 id={titleId} className="text-lg font-bold font-[family-name:var(--font-display)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close dialog"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {children}
                {footer && (
                    <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-border">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    /** danger: removes or discards something; warning: hard to undo; default: everyday confirmation. */
    variant?: 'danger' | 'warning' | 'default';
    loading?: boolean;
}

const CONFIRM_TONES = {
    danger: { icon: Trash2, tile: 'bg-red-500/12 text-red-600 dark:text-red-400', button: 'bg-red-600 text-white hover:bg-red-700' },
    warning: { icon: AlertTriangle, tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', button: 'bg-amber-500 text-white hover:bg-amber-600' },
    default: { icon: HelpCircle, tile: 'bg-primary/10 text-primary', button: 'bg-primary text-primary-foreground hover:opacity-90' },
} as const;

/**
 * The app's "are you sure?". Used instead of the browser's confirm(), which
 * can't be styled and on a phone shows a grey box headed with the site's
 * address. A bottom sheet with thumb-sized buttons on phones, a card in the
 * middle of the screen from sm up.
 */
export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    loading = false,
}: ConfirmDialogProps) {
    const { panelRef, backdropProps } = useDialogBehavior(isOpen, onClose);
    const titleId = useId();
    const messageId = useId();
    const cancelRef = useRef<HTMLButtonElement>(null);
    // Removing or discarding starts on Cancel, so a stray Enter can't do it.
    // Runs after the dialog's own first-field focus.
    useEffect(() => {
        if (isOpen && variant !== 'default') cancelRef.current?.focus();
    }, [isOpen, variant]);
    if (!isOpen) return null;
    const tone = CONFIRM_TONES[variant];
    const Icon = tone.icon;

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-backdrop-in sm:items-center sm:p-4" {...backdropProps}>
            <div
                ref={panelRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={message ? messageId : undefined}
                tabIndex={-1}
                className="w-full max-w-md animate-modal-in rounded-t-3xl border border-border/70 bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-2xl sm:p-6"
            >
                {/* The sheet's grab handle, on phones only. */}
                <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
                <div className="flex items-start gap-4">
                    <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`} aria-hidden>
                        <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                        <h2 id={titleId} className="text-base font-bold leading-snug text-foreground font-[family-name:var(--font-display)]">{title}</h2>
                        {message && <div id={messageId} className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{message}</div>}
                    </div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button ref={cancelRef} type="button" className="btn-secondary h-11 w-full sm:h-10 sm:w-auto" onClick={onClose} disabled={loading}>
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:w-auto ${tone.button}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                        {loading ? 'Working…' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
