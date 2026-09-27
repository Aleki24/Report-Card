/** Where the school is in its calendar, from its own terms. */
export type TermSummary =
  | { kind: 'in-term'; name: string; year: string | null; week: number; weeks: number; daysLeft: number; endDate: string }
  | { kind: 'break'; lastName: string | null; nextName: string | null; nextStart: string | null }
  | { kind: 'none' };

/** An exam sitting coming up: one class's round, rather than one row per paper. */
export interface UpcomingRound { key: string; label: string; className: string; firstDate: string; papers: number }
