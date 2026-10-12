/**
 * A `?redirect_url=` value as a path on this site, or null. Prefix checks
 * are not enough: browsers read "/\evil.com" (and tabs or newlines inside
 * it) as "//evil.com", another site. The value is parsed the way the
 * browser will, and kept only when it stays on `origin`. Client-safe.
 */
export function safeInternalPath(raw: string | null | undefined, origin: string): string | null {
    if (!raw || !raw.startsWith('/') || /[\\\u0000-\u001f]/.test(raw)) return null;
    try {
        const url = new URL(raw, origin);
        return url.origin === new URL(origin).origin ? `${url.pathname}${url.search}${url.hash}` : null;
    } catch {
        return null;
    }
}
