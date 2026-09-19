/**
 * Short labels for the two curricula.
 *
 * `academic_levels` stores display names in full — "Competency Based
 * Curriculum", "8-4-4 System" — which is right for a settings page and far too
 * long for a chip beside a class name or a segmented control above a subject
 * list. Every surface that needed a short form was inventing its own map, so
 * they lived here before they could drift apart.
 */

const SHORT_BY_CODE: Record<string, string> = {
    CBC: 'CBC',
    '844': '8-4-4',
};

/**
 * A short label for a curriculum, from its `academic_levels.code`.
 *
 * Falls back to the code itself, then the stored name, then null — a school
 * that has added its own academic level still gets something readable rather
 * than a blank chip.
 */
export function shortCurriculumLabel(
    code: string | null | undefined,
    name?: string | null,
): string | null {
    const trimmed = (code || '').trim();
    if (trimmed) return SHORT_BY_CODE[trimmed] ?? trimmed;
    const fallback = (name || '').trim();
    return fallback || null;
}
