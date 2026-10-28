import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BadgeCheck, Ban, Clock, ReceiptText, SearchX } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/utils';
import { formatKsh, methodLabel } from '@/lib/fee-account';
import { loadVerifiedReceipt, type VerifiedReceipt } from '@/lib/fee-receipt-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Check a receipt · Skulbase',
  robots: { index: false, follow: false },
};

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

const STANDING: Record<VerifiedReceipt['standing'], { icon: typeof BadgeCheck; title: string; body: string; tone: string }> = {
  valid: {
    icon: BadgeCheck,
    title: 'Genuine receipt',
    body: 'This payment is in the school’s records exactly as shown below.',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  voided: {
    icon: Ban,
    title: 'Voided receipt',
    body: 'The school cancelled this payment. The receipt no longer counts towards any fees.',
    tone: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
  },
  pending: {
    icon: Clock,
    title: 'Not confirmed',
    body: 'This online payment has not been confirmed yet, so there is no valid receipt for it.',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
};

/**
 * The page a fee receipt's QR code opens: anyone holding the receipt (a
 * parent, an auditor, a sponsor) can check it matches the school's records.
 * Server-rendered with no client JS, for phones on slow connections.
 */
export default async function VerifyReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const receipt = await loadVerifiedReceipt(paymentId).catch(() => null);

  if (!receipt) {
    return (
      <PageFrame>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
            <SearchX className="size-7" />
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">Receipt not found</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            This code doesn&apos;t match any receipt in a school&apos;s records. If you were given this receipt, check it with the school&apos;s accounts office.
          </p>
          <Link href="/" className="btn-secondary mt-2 no-underline">Go to <Wordmark /></Link>
        </div>
      </PageFrame>
    );
  }

  const standing = STANDING[receipt.standing];
  const StandingIcon = standing.icon;
  const paidOn = new Date(receipt.paidAt).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <PageFrame>
      <header className="flex items-center gap-3 border-b border-border pb-5">
        {receipt.school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- school-uploaded logo on an arbitrary host
          <img src={receipt.school.logoUrl} alt="" className="size-12 shrink-0 rounded-xl object-contain" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
            <ReceiptText className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold leading-tight text-foreground sm:text-xl">{receipt.school.name}</h1>
          <p className="text-xs text-muted-foreground">Fee receipt check</p>
        </div>
      </header>

      <div className={cn('mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3', standing.tone)}>
        <StandingIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm leading-relaxed">
          <strong>{standing.title}.</strong> <span className="text-muted-foreground">{standing.body}</span>
        </p>
      </div>

      <section className="mt-5 rounded-2xl border border-border/70 bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receipt {receipt.receiptNumber}</p>
        <p className={cn('mt-1 font-display text-3xl font-bold tabular-nums', receipt.standing === 'voided' ? 'text-muted-foreground line-through' : 'text-foreground')}>
          {formatKsh(receipt.amount)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Paid on</dt><dd className="font-medium">{paidOn}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Method</dt><dd className="font-medium">{methodLabel(receipt.method)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Learner</dt><dd className="font-medium">{receipt.learner}</dd></div>
          {receipt.termName && <div><dt className="text-xs text-muted-foreground">Term</dt><dd className="font-medium">{receipt.termName}</dd></div>}
        </dl>
      </section>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        Check the amount and receipt number match the paper you hold. Balances and contacts are only shown to the family, in the parent portal.
      </p>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
        <p>Powered by <Link href="/" className="font-semibold no-underline"><Wordmark /></Link></p>
      </footer>
    </PageFrame>
  );
}
