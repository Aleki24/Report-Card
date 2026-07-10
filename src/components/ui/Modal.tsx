'use client';

import React, { useEffect, useCallback, useRef, useId } from 'react';

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

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const mouseDownOnBackdrop = useRef(false);
    const titleId = useId();

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key === 'Tab' && panelRef.current) {
            const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === panelRef.current)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        // Focus the first field in the modal, falling back to the panel itself
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        (focusable && focusable.length > 1 ? focusable[1] : panelRef.current)?.focus();
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
            previouslyFocused?.focus?.();
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-backdrop-in"
            onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={e => {
                // Only close when the click started AND ended on the backdrop,
                // so drag-selecting text inside the modal never dismisses it
                if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={`card w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto animate-modal-in outline-none`}
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
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
    loading?: boolean;
}

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
    const confirmButtonClass = variant === 'danger'
        ? 'bg-red-500 hover:bg-red-600 text-white'
        : variant === 'warning'
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'btn-primary';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <button className="btn-secondary" onClick={onClose} disabled={loading}>
                    {cancelText}
                </button>
                <button
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all disabled:opacity-50 disabled:pointer-events-none ${confirmButtonClass}`}
                    onClick={onConfirm}
                    disabled={loading}
                >
                    {loading && (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    )}
                    {loading ? 'Processing...' : confirmText}
                </button>
            </div>
        </Modal>
    );
}
