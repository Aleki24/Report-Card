/**
 * Guardian contacts as the People page lists them: one per guardian, however
 * many of their children are on the roll. Client-safe.
 */

export interface ParentChild {
  id: string;
  admission_number: string | null;
  first_name: string;
  last_name: string;
  status: string;
  grade_stream: { full_name: string } | null;
}

export interface ParentContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  students: ParentChild[];
}

/**
 * Identifies one guardian across their children's records. Phones are
 * compared on their last nine digits, so 0712 345 678 and +254712345678 are
 * the same person; then email, ignoring case; then name. Null when a record
 * has no guardian details at all.
 */
export function guardianKey(phone: string | null, email: string | null, name: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length >= 9) return `tel:${digits.slice(-9)}`;
  const mail = email?.trim().toLowerCase();
  if (mail) return `mail:${mail}`;
  const who = name?.trim().toLowerCase().replace(/\s+/g, ' ');
  return who ? `name:${who}` : null;
}
