/**
 * Generates a username from the user's first name, school name, and a sequence number.
 *
 * Format: {firstName}{schoolName}{sequenceNumber}  (all lowercase, alphanumeric only)
 *
 * Examples:
 *   generateUsername("Alex", "Shalom Academy", 12)  → "alexshalomacademy12"
 *   generateUsername("Jane", "St. Mary's", 3)       → "janestmarys3"
 */
export function generateUsername(
    firstName: string,
    schoolName: string,
    sequenceNumber: number,
): string {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${clean(firstName)}${clean(schoolName)}${sequenceNumber}`;
}
