"use client";

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AUTH_SECONDARY_BUTTON, AuthShell, AuthStatus, type AuthStatusTone } from '@/components/auth/AuthShell';

type ViewState = 'checking' | 'completed' | 'failed' | 'pending';

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2500;

const VIEWS: Record<ViewState, { tone: AuthStatusTone; title: string; message: string }> = {
  checking: { tone: 'working', title: 'Confirming your payment', message: 'Checking with Pesapal. Please keep this tab open.' },
  completed: { tone: 'success', title: 'Payment received', message: 'Your fee balance has been updated. You can close this tab and go back to Skulbase.' },
  failed: { tone: 'error', title: 'Payment not completed', message: 'Nothing was charged. Go back to your fees page to try again.' },
  pending: { tone: 'waiting', title: 'Still processing', message: 'If you finished paying, your balance will update as soon as Pesapal confirms it. You can close this tab.' },
};

interface StatusResponse { data?: { status?: string } }

/**
 * Pesapal sends the payer's browser here after checkout. The ledger itself is
 * updated by the IPN webhook; this page only tells the payer how it went.
 */
function PesapalCallbackContent() {
  const searchParams = useSearchParams();
  const orderTrackingId = searchParams.get('OrderTrackingId') ?? searchParams.get('orderTrackingId');
  const [view, setView] = useState<ViewState>(orderTrackingId ? 'checking' : 'pending');

  useEffect(() => {
    if (!orderTrackingId) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/pesapal/status?order_tracking_id=${encodeURIComponent(orderTrackingId)}`);
        if (res.ok) {
          const status = ((await res.json()) as StatusResponse).data?.status;
          if (cancelled) return;
          if (status === 'COMPLETED') return setView('completed');
          if (status === 'FAILED') return setView('failed');
        }
      } catch {
        // A dropped request just uses up one attempt.
      }
      if (cancelled) return;
      if (attempts >= POLL_ATTEMPTS) setView('pending');
      else timer = setTimeout(check, POLL_INTERVAL_MS);
    };

    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [orderTrackingId]);

  const { tone, title, message } = VIEWS[view];
  return (
    <AuthShell title={title}>
      <AuthStatus tone={tone} message={message}>
        {view !== 'checking' && (
          <Link href="/student/fees" className={`${AUTH_SECONDARY_BUTTON} no-underline`}>Go to my fees</Link>
        )}
      </AuthStatus>
    </AuthShell>
  );
}

export default function PesapalCallbackPage() {
  return (
    <Suspense fallback={<AuthShell title="Confirming your payment"><AuthStatus tone="working" message="Loading…" /></AuthShell>}>
      <PesapalCallbackContent />
    </Suspense>
  );
}
