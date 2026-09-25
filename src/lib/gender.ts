export type Gender = 'MALE' | 'FEMALE';

/**
 * The stored form of whatever a spreadsheet says: M, Male, boy, F, Female,
 * girl… Null when it names neither, so a stray value is left empty rather
 * than saved as-is. Client-safe.
 */
export function normalizeGender(value: string | null | undefined): Gender | null {
  const v = value?.trim().toUpperCase() ?? '';
  if (['M', 'MALE', 'BOY'].includes(v)) return 'MALE';
  if (['F', 'FEMALE', 'GIRL'].includes(v)) return 'FEMALE';
  return null;
}
