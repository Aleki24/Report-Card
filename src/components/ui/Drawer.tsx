'use client';

import React, { useEffect, useCallback, useRef, useId } from 'react';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Panel width. 'md' fits a single-column form; 'lg' gives a longer writing area. */
    size?: 'md' | 'lg';
}

const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-xl',
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Slide-over panel for create/edit forms. Unlike Modal, the page behind it
 * (the list being edited) stays visible and scrollable — useful when
 * writing something long enough that glancing back at existing entries helps.
 */
export function Drawer({ isOpen, onClose, title, children, footer, size = 'md' }: DrawerProps) {
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
            className="fixed inset-0 z-[100] bg-black/20 animate-backdrop-in"
            onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={e => {
                if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={`card fixed inset-y-0 right-0 flex w-full ${sizeClasses[size]} flex-col rounded-none border-y-0 border-r-0 animate-drawer-in outline-none`}
                style={{ maxHeight: '100vh' }}
            >
                <div className="flex items-center justify-between border-b border-border px-6 py-5 shrink-0">
                    <h2 id={titleId} className="text-lg font-bold font-[family-name:var(--font-display)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Close panel"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {children}
                </div>
                {footer && (
                    <div className="flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
