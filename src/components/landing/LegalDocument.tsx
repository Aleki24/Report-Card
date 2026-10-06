import type { ReactNode } from 'react';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * A long policy page: a contents list, then numbered sections. Prose styles
 * live here so each policy only supplies its words.
 */
export function LegalDocument({ updated, sections }: { updated: string; sections: readonly LegalSection[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm text-muted-foreground">Last updated {updated}</p>

      <nav aria-label="Contents" className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Contents</h2>
        <ol className="mt-3 grid list-decimal gap-1.5 pl-5 text-sm sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary underline-offset-4 hover:underline">{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 flex flex-col gap-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-28">
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
