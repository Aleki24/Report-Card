"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

type ViewState = 'checking' | 'completed' | 'failed' | 'pending' | 'unknown';

/**
 * Pesapal redirects the payer's browser here after they finish (or cancel)
 * checkout on Pesapal's hosted page. This tab is informational only — the
 * actual ledger update comes from the IPN webhook (server-to-server) and
 * the original tab's own polling; this page just gives the payer a clear
 * result instead of a blank redirect target, using the same browser
 * session (still logged in) to check status for a nicer message.
 */
function PesapalCallbackContent() {
    const searchParams = useSearchParams();
    const orderTrackingId = searchParams.get('OrderTrackingId') || searchParams.get('orderTrackingId');
    const [view, setView] = useState<ViewState>('checking');

    useEffect(() => {
        if (!orderTrackingId) {
            setView('unknown');
            return;
        }
        let cancelled = false;
        let attempts = 0;

        const check = async () => {
            attempts++;
            try {
                const res = await fetch(`/api/pesapal/status?order_tracking_id=${encodeURIComponent(orderTrackingId)}`);
                if (res.ok) {
                    const json = await res.json();
                    const status = json.data?.status;
                    if (cancelled) return;
                    if (status === 'COMPLETED') return setView('completed');
                    if (status === 'FAILED') return setView('failed');
                }
            } catch {
                // ignore transient errors, keep polling until the attempt budget runs out
            }
            if (cancelled) return;
            if (attempts >= 8) {
                setView('pending');
            } else {
                setTimeout(check, 2500);
            }
        };

        check();
        return () => { cancelled = true; };
    }, [orderTrackingId]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            {view === 'checking' && (
                <>
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-lg font-semibold">Confirming your payment…</p>
                    <p className="text-sm text-muted-foreground">Please wait a moment.</p>
                </>
            )}
            {view === 'completed' && (
                <>
                    <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    <p className="text-lg font-semibold">Payment received</p>
                    <p className="text-sm text-muted-foreground">You can close this tab and return to the app — your balance has been updated.</p>
                </>
            )}
            {view === 'failed' && (
                <>
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <p className="text-lg font-semibold">Payment not completed</p>
                    <p className="text-sm text-muted-foreground">You can close this tab and try again from the app.</p>
                </>
            )}
            {(view === 'pending' || view === 'unknown') && (
                <>
                    <Loader2 className="h-10 w-10 text-muted-foreground" />
                    <p className="text-lg font-semibold">Still processing</p>
                    <p className="text-sm text-muted-foreground">
                        You can close this tab. If you completed the payment, your balance will update shortly once it&apos;s confirmed.
                    </p>
                </>
            )}
        </div>
    );
}

export default function PesapalCallbackPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
            <PesapalCallbackContent />
        </Suspense>
    );
}
