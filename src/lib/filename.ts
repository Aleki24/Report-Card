/**
 * A label (a learner's name, a class, an exam) as a download file name.
 * HTTP headers carry only Latin-1, so a name like "Wanjĩru" or a title with
 * an en dash made the response throw after the file was built. Accents are
 * dropped (ĩ → i) and anything else outside A–Z/0–9 becomes "_".
 */
export function safeFileName(value: string | null | undefined, fallback: string): string {
    const ascii = (value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '');
    return ascii.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || fallback;
}
