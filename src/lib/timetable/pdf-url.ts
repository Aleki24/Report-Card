/** Which timetable a download covers. `master` is the whole school. */
export type TimetablePdfView = 'mine' | 'class' | 'teacher' | 'room' | 'master';

/** The download link for a timetable PDF; `version` picks a draft (managers only). */
export function timetablePdfUrl(opts: { view: TimetablePdfView; id?: string; version?: string }): string {
    const q = new URLSearchParams({ view: opts.view });
    if (opts.id) q.set('id', opts.id);
    if (opts.version) q.set('version', opts.version);
    return `/api/academics/timetable/pdf?${q}`;
}
