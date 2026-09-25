"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Hourglass, KeyRound, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { PREVIEW_LOCKED_MESSAGE, uninstallPreviewFetch } from '@/lib/preview/preview-fetch';
import { DEMO_SCHOOL_NAME } from '@/lib/preview/demo-school';

/** How often the banner asks whether the school has been approved. */
const POLL_MS = 60_000;

/**
 * Controls that would change something, known by what they say they do.
 * Everything else (opening a class, paging, filtering, switching tabs)
 * stays usable, so the preview can actually be explored. Any change a label
 * misses is still refused: writes never leave the browser in preview.
 */
const CHANGES = /\b(add|new|create|set up|setup|save|delete|remove|edit|rename|import|export|download|print|send|sms|generate|pay|record|assign|upload|publish|release|unpublish|submit|invite|reset|approve|reject|notify|apply|update|activate|deactivate|mark|move|detach|sync|seed|enter|take|restore|archive|duplicate|join|place|promote|split|done)\b/i;

/** Where the lock applies: the page itself and any dialog over it. */
const LOCKED_REGION = 'main, [role="dialog"]';

const CONTROL = 'button, [role="button"], input[type="submit"], input[type="button"]';

function isAllowed(el: Element): boolean {
  if (!el.closest(LOCKED_REGION)) return true; // sidebar, bottom navigation, account menu
  if (el.closest('[data-preview-allow]')) return true;
  // Tabs, filter tiles and menu toggles only change what is shown.
  if (el.getAttribute('role') === 'tab' || el.hasAttribute('aria-pressed') || el.hasAttribute('aria-expanded')) return true;
  if (el.getAttribute('type') === 'submit') return false;
  const label = [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].filter(Boolean).join(' ');
  return !CHANGES.test(label);
}

/**
 * Marks every locking control disabled-looking (and `aria-disabled` for
 * assistive tech), refuses their clicks and any form submit, and says why.
 * Content appears and changes as pages load, so marking re-runs on change.
 */
function usePreviewLock(active: boolean) {
  const lastToast = useRef(0);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.preview = '';

    const mark = () => {
      document.querySelectorAll(CONTROL).forEach(el => {
        const locked = !isAllowed(el);
        if (locked && !el.hasAttribute('data-preview-locked')) {
          el.setAttribute('data-preview-locked', '');
          el.setAttribute('aria-disabled', 'true');
        } else if (!locked && el.hasAttribute('data-preview-locked')) {
          el.removeAttribute('data-preview-locked');
          el.removeAttribute('aria-disabled');
        }
      });
    };
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(mark);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    mark();

    const explain = () => {
      const now = Date.now();
      if (now - lastToast.current < 2500) return;
      lastToast.current = now;
      toast.info(PREVIEW_LOCKED_MESSAGE, { description: 'You are exploring sample data while your school is reviewed.' });
    };
    const onClick = (e: MouseEvent) => {
      const control = (e.target as Element | null)?.closest(CONTROL);
      if (!control || isAllowed(control)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      explain();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as Element | null;
      if (!form || !form.closest(LOCKED_REGION) || form.closest('[data-preview-allow]')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      explain();
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      delete root.dataset.preview;
      document.querySelectorAll('[data-preview-locked]').forEach(el => {
        el.removeAttribute('data-preview-locked');
        el.removeAttribute('aria-disabled');
      });
    };
  }, [active]);
}

type Status = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | null;

async function fetchStatus(): Promise<Status> {
  const res = await fetch('/api/school/approval-status', { cache: 'no-store' });
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: Status };
  return json.status ?? null;
}

/**
 * The banner over every page in preview: what the visitor is looking at,
 * that their school is waiting, and what happens next. It checks for the
 * decision and reloads into the real account the moment it lands.
 */
export function PreviewBanner() {
  const { preview, pendingSchoolName } = useAuth();
  const [checking, setChecking] = useState(false);
  usePreviewLock(preview);

  const settle = useCallback((status: Status, announce: boolean) => {
    if (status === 'APPROVED' || status === 'REJECTED') {
      uninstallPreviewFetch();
      if (status === 'APPROVED') toast.success('Your school has been approved. Opening your account…');
      window.location.assign(status === 'APPROVED' ? '/dashboard' : '/dashboard/onboarding');
    } else if (announce) {
      toast.info('Still waiting for approval. We will email you when it is reviewed.');
    }
  }, []);

  useEffect(() => {
    if (!preview) return;
    const id = window.setInterval(() => { fetchStatus().then(s => settle(s, false)).catch(() => {}); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [preview, settle]);

  if (!preview) return null;

  const check = async () => {
    setChecking(true);
    try {
      settle(await fetchStatus(), true);
    } catch {
      toast.error('Could not check right now. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <section data-preview-allow aria-label="Preview mode" className="mb-6 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-card to-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400" aria-hidden>
            <Hourglass className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {pendingSchoolName ?? 'Your school'} is waiting for approval
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                <Sparkles className="size-3" aria-hidden />Preview
              </span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Meanwhile, explore Skulbase with sample data from <strong className="font-medium text-foreground">{DEMO_SCHOOL_NAME}</strong>.
              Buttons that change anything unlock once your school is approved; we&apos;ll email you.
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <button type="button" className="btn-secondary" onClick={() => void check()} disabled={checking}>
            {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            Check status
          </button>
          <Link href="/dashboard/onboarding?join=1" className="btn-secondary">
            <KeyRound className="size-4" aria-hidden /><span className="sm:hidden">Invite code</span><span className="hidden sm:inline">I have an invite code</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
