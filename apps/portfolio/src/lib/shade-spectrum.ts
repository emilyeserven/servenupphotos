/**
 * The row each pin goes in so none overlap, for pins size pixels wide centered at xs (pixels from
 * the left): each pin, from left to right, takes the first row where it's at least size + gap from
 * the last pin in that row. Pins at nearly the same lightness stack into a column, like a
 * beeswarm chart.
 */
export function stackRows(xs: number[], size: number, gap: number): number[] {
  const rowEnds: number[] = [];
  const rows = Array.from({ length: xs.length }, () => 0);
  const order = xs.map((x, i) => ({ x, i })).toSorted((a, b) => a.x - b.x);
  for (const { x, i } of order) {
    const row = firstFreeRow(rowEnds, x - size - gap);
    rowEnds[row] = x;
    rows[i] = row;
  }
  return rows;
}

/** The first row whose last pin is at or left of upTo, or a new row past the last one. */
function firstFreeRow(rowEnds: number[], upTo: number): number {
  const free = rowEnds.findIndex((end) => end <= upTo);
  return free === -1 ? rowEnds.length : free;
}
