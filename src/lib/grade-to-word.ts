/**
 * Maps a numeric grade/class level to its English word.
 * Used for auto-generating passwords for students and class teachers.
 *
 * Example:  gradeToWord(9)  → "nine"
 */

const GRADE_WORDS: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
};

export function gradeToWord(gradeNumericOrder: number): string {
    return GRADE_WORDS[gradeNumericOrder] || String(gradeNumericOrder);
}
