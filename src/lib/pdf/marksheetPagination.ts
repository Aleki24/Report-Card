/**
 * How a class mark sheet splits across pages.
 *
 * Two rules, in order:
 *   1. Use as few pages as possible, keeping the summary (subject statistics,
 *      analysis and sign-off) under the last rows of the table when it fits.
 *   2. Share the learners across those pages in proportion to the room each
 *      page has, so no page ends with a lone learner or two and a band of white.
 *      A class one learner too big for page one prints as two evenly filled
 *      pages, not a full page and a nearly empty one.
 *
 * Rows then grow (up to a cap) to take up the room the balancing left, with
 * one height for every page so the sheet reads as a single table.
 *
 * Every height here is a fixed layout dimension from the mark sheet itself,
 * which is what makes the plan exact rather than an estimate: names are
 * clipped to one line, so no row can grow on its own.
 */

export interface PageDimensions {
    /** Height available for content on every page (page minus footer and margins). */
    usable: number;
    /** Masthead and KPI strip — first page only. */
    firstChrome: number;
    /** The slim running header on continuation pages. */
    otherChrome: number;
    /** The table's column headings, repeated on every page. */
    tableHead: number;
    /** A learner row at its natural height. */
    row: number;
    /** Everything after the last learner row: statistics rows, analysis, sign-off. */
    summary: number;
    /** How far a row may grow to fill a page, as a multiple of `row`. */
    maxRowGrowth: number;
}

export interface PagePlan {
    /** Learner rows on each table page, in order. */
    rows: number[];
    /** Row height used on every page. */
    rowHeight: number;
    /** True when the summary could not share a page with the table. */
    summaryOnOwnPage: boolean;
}

const fit = (space: number, row: number) => Math.max(0, Math.floor(space / row));

/**
 * Split `total` rows across pages with the given capacities, proportionally,
 * never exceeding a page's capacity and never leaving a page empty.
 */
export function balance(total: number, capacities: number[]): number[] {
    const room = capacities.reduce((sum, c) => sum + c, 0);
    if (total <= 0 || capacities.length === 0) return capacities.map(() => 0);
    const share = Math.min(1, total / room);
    const rows = capacities.map(c => Math.max(1, Math.min(c, Math.floor(c * share))));
    let left = total - rows.reduce((sum, r) => sum + r, 0);
    // Hand out what flooring left over to the pages with the most slack first,
    // and take back any excess the one-row minimum created from the fullest.
    while (left !== 0) {
        const order = capacities
            .map((c, i) => ({ i, slack: (c - rows[i]) / c }))
            .filter(({ i }) => (left > 0 ? rows[i] < capacities[i] : rows[i] > 1))
            .sort((a, b) => (left > 0 ? b.slack - a.slack : a.slack - b.slack));
        if (order.length === 0) break;
        rows[order[0].i] += left > 0 ? 1 : -1;
        left += left > 0 ? -1 : 1;
    }
    return rows;
}

export function planPages(total: number, d: PageDimensions): PagePlan {
    const tableSpace = (chrome: number, withSummary: boolean) =>
        d.usable - chrome - d.tableHead - (withSummary ? d.summary : 0);

    const firstFull = fit(tableSpace(d.firstChrome, false), d.row);
    const otherFull = fit(tableSpace(d.otherChrome, false), d.row);
    const firstLast = fit(tableSpace(d.firstChrome, true), d.row);
    const otherLast = fit(tableSpace(d.otherChrome, true), d.row);

    // Capacities of an n-page table whose last page also carries the summary.
    const withSummary = (n: number): number[] =>
        n === 1 ? [firstLast] : [firstFull, ...Array(n - 2).fill(otherFull), otherLast];

    let capacities: number[] | null = null;
    let summaryOnOwnPage = false;

    if (total <= firstLast) {
        capacities = withSummary(1);
    } else if (otherLast > 0 && otherFull > 0) {
        let n = 2;
        while (withSummary(n).reduce((sum, c) => sum + c, 0) < total) n++;
        capacities = withSummary(n);
    }

    if (!capacities) {
        // The summary is taller than a continuation page can spare: give it a
        // page of its own and fill the table pages without reserving room.
        summaryOnOwnPage = true;
        const perOther = Math.max(1, otherFull);
        const n = total <= firstFull ? 1 : 1 + Math.ceil((total - firstFull) / perOther);
        capacities = [firstFull, ...Array(n - 1).fill(perOther)];
    }

    const rows = balance(total, capacities);

    // One row height for the whole sheet: the largest every page can take.
    const room = rows.map((r, i) => {
        const first = i === 0;
        const last = i === rows.length - 1 && !summaryOnOwnPage;
        const space = tableSpace(first ? d.firstChrome : d.otherChrome, last);
        return r > 0 ? space / r : Infinity;
    });
    const rowHeight = Math.min(d.row * d.maxRowGrowth, ...room);

    return { rows, rowHeight: Math.max(d.row, rowHeight), summaryOnOwnPage };
}
