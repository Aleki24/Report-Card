/**
 * Grids whose column count follows how many items there are.
 *
 * A fixed `xl:grid-cols-5` with two tiles in it leaves three empty tracks, which
 * is what left the dashboard looking half-built. `auto-fit` collapses unused
 * tracks so whatever is there stretches to fill the row, and `min(100%, …)`
 * keeps a single item from overflowing a narrow phone.
 */
export const AUTO_FIT_GRID = {
  /** Small figure tiles: two across on a phone, as many as fit above that. */
  tile: 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))]',
  /** Cards with a sentence or a chart in them. */
  card: 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))]',
} as const;
