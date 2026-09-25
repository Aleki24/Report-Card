"use client";

import { useState } from 'react';
import { ArrowLeft, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { describeCodeError, type PendingCodeVerification } from '@/hooks/useSignInCodeVerification';
import { AUTH_INPUT, AUTH_LABEL, AUTH_PRIMARY_BUTTON } from '@/components/auth/AuthShell';
import { cn } from '@/lib/utils';

interface VerificationCodeStepProps {
  pending: PendingCodeVerification;
  /** Seconds left before another code may be requested. */
  cooldown: number;
  /** Resolves true once the session is active. Throws Clerk errors on a bad code. */
  onVerify: (code: string) => Promise<boolean>;
  onResend: () => Promise<void>;
  /** Called after a successful verification, with the session already active. */
  onVerified: () => void;
  onBack: () => void;
}

const CODE_LENGTH = 6;

/**
 * The "enter the code we sent you" step of a Clerk sign-in, shared by /login
 * and /signup. Renders in place of the page's form, inside its card.
 */
export function VerificationCodeStep({
  pending,
  cooldown,
  onVerify,
  onResend,
  onVerified,
  onBack,
}: VerificationCodeStepProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const channel = pending.strategy === 'email_code' ? 'email' : 'phone';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      if (await onVerify(code)) {
        onVerified();
      } else {
        setError('Verification could not be completed. Request a new code and try again.');
      }
    } catch (err) {
      setError(describeCodeError(err));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      await onResend();
      setCode('');
      toast.success(`A new code is on its way to your ${channel}.`);
    } catch (err) {
      setError(describeCodeError(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-300">
          {channel === 'email' ? <MailCheck className="size-6" aria-hidden /> : <ShieldCheck className="size-6" aria-hidden />}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Check your {channel}
          </h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            We sent a {CODE_LENGTH}-digit verification code to{' '}
            <span className="font-semibold break-all text-slate-700 dark:text-slate-200">{pending.safeIdentifier}</span>.
            {channel === 'email' && ' It can take a minute to arrive — check your spam folder too.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="verification-code" className={AUTH_LABEL}>
          Verification code
        </label>
        <input
          id="verification-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          placeholder="••••••"
          autoFocus
          required
          aria-invalid={error !== null}
          aria-describedby={error ? 'verification-code-error' : undefined}
          className={cn(AUTH_INPUT, 'text-center font-mono text-lg tracking-[0.5em] sm:text-lg')}
        />
        {error && (
          <p id="verification-code-error" role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={verifying || code.length !== CODE_LENGTH}
        className={AUTH_PRIMARY_BUTTON}
      >
        {verifying ? <Loader2 className="size-5 animate-spin" aria-label="Verifying" /> : 'Verify and continue'}
      </button>

      <div className="flex flex-col-reverse items-center justify-between gap-3 text-sm sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="inline-flex items-center gap-1.5 font-semibold text-indigo-500 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:opacity-100 dark:text-indigo-400 dark:disabled:text-slate-500"
        >
          {resending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
