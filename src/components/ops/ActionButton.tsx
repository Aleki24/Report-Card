"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { errorText, opsFetch } from '@/lib/ops/client';

interface ActionButtonProps {
    url: string;
    body?: unknown;
    method?: 'POST' | 'PATCH';
    success: string;
    /** Refresh after success (a list's reload). */
    onDone?: () => void | Promise<void>;
    variant?: 'default' | 'outline' | 'destructive' | 'ghost';
    children: React.ReactNode;
}

/** A row button that calls an API action, toasts the outcome and refreshes. */
export function ActionButton({ url, body, method = 'POST', success, onDone, variant = 'default', children }: ActionButtonProps) {
    const [busy, setBusy] = useState(false);
    return (
        <Button size="xs" variant={variant} disabled={busy} onClick={async () => {
            setBusy(true);
            try {
                await opsFetch(url, body === undefined ? { method } : { method, json: body });
                toast.success(success);
                await onDone?.();
            } catch (err) { toast.error(errorText(err)); }
            finally { setBusy(false); }
        }}>
            {children}
        </Button>
    );
}
