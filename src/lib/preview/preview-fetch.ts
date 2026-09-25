import { demoResponse } from './demo-school';

/** Shown whenever something would change data while the school waits. */
export const PREVIEW_LOCKED_MESSAGE = 'Available once your school is approved.';

/**
 * Requests that still go to the server in preview: the account itself, the
 * approval status the banner watches for, joining another school with an
 * invite code, and the public report-card check.
 */
const PASSTHROUGH = [/^\/api\/auth\//, /^\/api\/school\/approval-status$/, /^\/api\/school\/join$/, /^\/api\/verify\//];

let original: typeof fetch | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * While a school waits for approval, its admin explores Skulbase on a demo
 * school: every read from this app's API is answered from sample data, and
 * every write is refused here, before it leaves the browser. The account is
 * still PENDING on the server, which refuses both anyway, so this changes
 * what is shown, never what is allowed.
 */
export function installPreviewFetch(): void {
  if (typeof window === 'undefined' || original) return;
  original = window.fetch.bind(window);
  const passthrough = original;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), window.location.origin);
    const sameApp = url.origin === window.location.origin && url.pathname.startsWith('/api/');
    if (!sameApp || PASSTHROUGH.some(p => p.test(url.pathname))) return passthrough(input, init);

    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return json({ error: PREVIEW_LOCKED_MESSAGE, preview: true }, 403);
    return json(demoResponse(url));
  };
}

/** Puts the real fetch back (on approval, before reloading). */
export function uninstallPreviewFetch(): void {
  if (typeof window === 'undefined' || !original) return;
  window.fetch = original;
  original = null;
}
