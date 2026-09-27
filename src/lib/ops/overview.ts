/** The cockpit tile shape, shared by the overview API and the dashboard. Client-safe. */
export type TileTone = 'default' | 'good' | 'warn' | 'bad';

export interface OverviewTile {
    key: string;
    label: string;
    value: string | number;
    hint?: string;
    href: string;
    tone: TileTone;
}
