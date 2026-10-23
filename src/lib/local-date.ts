/** Client-safe and shared with the mobile app, so it has no imports. */

/** Today in the viewer's time zone, as the date inputs show it. */
export function localToday(now = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
