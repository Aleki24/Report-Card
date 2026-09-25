'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogBehavior {
    /** Attach to the dialog panel: focus is trapped inside it. */
    panelRef: RefObject<HTMLDivElement | null>;
    /** Spread on the backdrop so only a click that starts and ends on it closes the dialog. */
    backdropProps: {
        onMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
        onClick: (e: React.MouseEvent<HTMLElement>) => void;
    };
}

/**
 * The shared behaviour of every overlay (Modal, Drawer, profile dialogs):
 * Escape closes, Tab is trapped inside the panel, the page behind stops
 * scrolling, the first field gets focus and focus returns to the opener on
 * close.
 */
export function useDialogBehavior(isOpen: boolean, onClose: () => void): DialogBehavior {
    const panelRef = useRef<HTMLDivElement>(null);
    const mouseDownOnBackdrop = useRef(false);

    // onClose is typically a fresh arrow function on every parent render
    // (e.g. onClose={() => setOpen(false)}). Reading it through a ref keeps
    // handleKeyDown — and therefore the effect below — stable across
    // keystrokes in a controlled input, instead of re-running init-focus
    // logic (and yanking focus back to the first field) on every keypress.
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCloseRef.current();
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
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        // Focus the first field (the close button is always first), falling back to the panel itself
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
        (focusable && focusable.length > 1 ? focusable[1] : panelRef.current)?.focus();
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
            previouslyFocused?.focus?.();
        };
    }, [isOpen, handleKeyDown]);

    const backdropProps: DialogBehavior['backdropProps'] = {
        onMouseDown: e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; },
        onClick: e => {
            // Only close when the click started AND ended on the backdrop,
            // so drag-selecting text inside the dialog never dismisses it
            if (e.target === e.currentTarget && mouseDownOnBackdrop.current) onCloseRef.current();
        },
    };

    return { panelRef, backdropProps };
}
