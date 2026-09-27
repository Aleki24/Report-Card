import type { UpcomingRound } from '@/lib/dashboard';

/** Each class's coming exam sitting, one line per round rather than per paper. */
export default function UpcomingRounds({ rounds }: { rounds: UpcomingRound[] }) {
  if (rounds.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">No exams in the next three weeks.</p>;
  return (
    <ul className="-mx-1 flex flex-col">
      {rounds.map(r => {
        const date = new Date(`${r.firstDate}T00:00:00`);
        return (
          <li key={r.key} className="flex items-center gap-3 rounded-xl px-1 py-2">
            <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-muted/60 py-1 text-center" aria-hidden>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">{date.toLocaleDateString('en-GB', { month: 'short' })}</span>
              <span className="text-base font-bold leading-none text-foreground">{date.getDate()}</span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{r.className} · {r.label}</p>
              <p className="text-xs text-muted-foreground">{r.papers} paper{r.papers === 1 ? '' : 's'} · from {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
