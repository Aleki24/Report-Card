import type { ReactNode } from 'react';
import Image from 'next/image';

/** Full-width gradient call to action used on every auth screen. */
export const AUTH_PRIMARY_BUTTON =
  'flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-indigo-500 to-violet-500 text-[15px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.3)] transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

/** Quiet outlined button for the alternative path (Google, secondary actions). */
export const AUTH_SECONDARY_BUTTON =
  'flex h-[46px] w-full items-center justify-center gap-3 rounded-xl border border-black/[0.08] bg-black/[0.02] text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]';

/**
 * Text field on the auth card. Deliberately not `.input-field`: that class is
 * unlayered, so it would override these utilities. 16px text on phones stops
 * iOS zooming in on focus.
 */
export const AUTH_INPUT =
  'h-[46px] w-full rounded-xl border border-black/10 bg-white px-4 text-base text-slate-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-[3px] focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-500 sm:text-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500';

/** Small field label matching the auth card. */
export const AUTH_LABEL = 'text-xs font-semibold text-slate-600 dark:text-slate-400';

/** Link colour used for inline auth links. */
export const AUTH_LINK = 'font-semibold text-indigo-500 no-underline hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300';

interface AuthShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Card contents. */
  children: ReactNode;
  /** Links and notes shown under the card. */
  footer?: ReactNode;
}

/**
 * The frame shared by /login, /signup and /activate: soft gradient backdrop,
 * logo, heading and a frosted card. Theme-aware through the `dark:` variant,
 * which follows the app's ThemeProvider.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-linear-135 from-slate-50 via-slate-200 to-slate-100 px-4 py-10 sm:px-6 dark:from-[#0f0f14] dark:via-[#1a1a2e] dark:to-[#16213e]">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute -top-1/5 left-[10%] h-[50vh] w-[50vw] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.08)_0%,transparent_70%)] blur-[80px] dark:bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -right-[5%] bottom-[10%] h-[35vh] w-[35vw] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.06)_0%,transparent_70%)] blur-[60px] dark:bg-[radial-gradient(circle,rgba(139,92,246,0.12)_0%,transparent_70%)]" />

      <div className="relative z-10 w-full max-w-[440px]">
        <header className="mb-8 text-center">
          <Image
            src="/images/logo.png"
            alt="Skulbase Logo"
            width={64}
            height={64}
            priority
            className="mx-auto mb-5 rounded-2xl object-cover shadow-[0_8px_32px_rgba(99,102,241,0.3)]"
          />
          <h1 className="mb-2 text-[26px] font-extrabold tracking-tighter text-slate-900 sm:text-[28px] dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </header>

        <main className="rounded-2xl border border-black/[0.06] bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-[20px] sm:p-8 dark:border-white/[0.08] dark:bg-[rgba(30,30,46,0.8)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
          {children}
        </main>

        {footer && (
          <footer className="mt-6 flex flex-col items-center gap-1 text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Google "G" mark for the OAuth buttons. */
export function GoogleIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/** "or continue with" rule between the main form and alternatives. */
export function AuthDivider({ label = 'or continue with' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/10" />
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
      <div className="h-px flex-1 bg-black/[0.08] dark:bg-white/10" />
    </div>
  );
}
