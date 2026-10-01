/** Class naming, shared by the server, the web forms and the mobile app. Pure. */

export type ClassNames = { name: string; full_name: string };

/** Name and full name for a class; no stream name means the grade's only class. */
export function classNames(gradeName: string, streamName?: string | null): ClassNames {
    const grade = gradeName.trim();
    const stream = streamName?.trim();
    return stream ? { name: stream, full_name: `${grade} ${stream}` } : { name: grade, full_name: grade };
}

/** "East, West ,  North" → ["East", "West", "North"], without repeats. */
export function parseStreamNames(input: string): string[] {
    const seen = new Set<string>();
    return input
        .split(',')
        .map(s => s.trim())
        .filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}
