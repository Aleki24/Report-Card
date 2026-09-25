/** Title-case an enum-ish value: "TRANSFERRED" → "Transferred", "stem_pure" → "Stem pure". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
