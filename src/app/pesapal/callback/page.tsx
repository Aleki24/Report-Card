"use client";

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AUTH_SECONDARY_BUTTON, AuthShell, AuthStatus, type AuthStatusTone } from '@/components/auth/AuthShell';
import { PESAPAL_NOT_CONFIRMED_MESSAGE, paymentWaitStep } from '@/lib/fees';

type ViewState = 'checking' | 'completed' | 'failed' | 'pending';

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2500;

const VIEWS: Record<ViewState, { tone: AuthStatusTone; title: string; message: string }> = {
  checking: { tone: 'working', title: 'Confirming your payment', message: 'Checking with Pesapal. Please keep this tab open.' },
  completed: { tone: 'success', title: 'Payment received', message: 'Your fee balance has been updated. You can close this tab and go back to Skulbase.' },
  failed: { tone: 'error', title: 'Payment not confirmed', message: PESAPAL_NOT_CONFIRMED_MESSAGE },
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
    let lastStatus: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/pesapal/status?order_tracking_id=${encodeURIComponent(orderTrackingId)}`);
        if (res.ok) {
          lastStatus = ((await res.json()) as StatusResponse).data?.status;
          if (cancelled) return;
          // A FAILED attempt can still succeed on a retry: keep checking.
          const step = paymentWaitStep(lastStatus, 'PESAPAL');
          if (step === 'paid') return setView('completed');
          if (step === 'failed') return setView('failed');
        }
      } catch {
        // A dropped request just uses up one attempt.
      }
      if (cancelled) return;
      if (attempts >= POLL_ATTEMPTS) setView(lastStatus === 'FAILED' ? 'failed' : 'pending');
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
