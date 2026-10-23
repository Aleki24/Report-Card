'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from './Modal';

export interface ConfirmOptions {
    title: string;
    message?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * One confirmation dialog for the whole app, asked for like the browser's
 * confirm() but styled:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Release 60 papers?', message: '…' }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [request, setRequest] = useState<ConfirmOptions | null>(null);
    const resolver = useRef<((answer: boolean) => void) | null>(null);

    const confirm = useCallback<Confirm>(options => new Promise<boolean>(resolve => {
        // A second question while one is open answers the first with "no".
        resolver.current?.(false);
        resolver.current = resolve;
        setRequest(options);
    }), []);

    const answer = (value: boolean) => {
        resolver.current?.(value);
        resolver.current = null;
        setRequest(null);
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog
                isOpen={request !== null}
                onClose={() => answer(false)}
                onConfirm={() => answer(true)}
                title={request?.title ?? ''}
                message={request?.message}
                confirmText={request?.confirmText}
                cancelText={request?.cancelText}
                variant={request?.variant}
            />
        </ConfirmContext.Provider>
    );
}

/** Ask the person to confirm; resolves true for the confirm button, false otherwise. */
export function useConfirm(): Confirm {
    const confirm = useContext(ConfirmContext);
    if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>.');
    return confirm;
}
