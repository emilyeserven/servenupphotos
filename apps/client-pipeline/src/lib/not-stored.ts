/** Where a Not Stored post stands in for a photo file: a path no photo file has, made from its day. */
export function notStoredPath(day: string): string {
  return `not-stored:${day}`;
}

/** Each day's Not Stored post, by day. */
export function notStoredByDay<T extends { day: string }>(posts: T[]): Map<string, T> {
  return new Map(posts.map((post) => [post.day, post]));
}

/**
 * The calendar's photo for each day (byDay) with the days that only have a Not Stored post filled in
 * by its stand-in path, so they take a place in the rows of the feed. A day with a photo keeps it.
 */
export function withNotStoredDays(
  byDay: Map<string, { path: string }>,
  notStored: Map<string, unknown>,
): Map<string, { path: string }> {
  const days = new Map(byDay);
  for (const day of notStored.keys()) {
    if (!days.has(day)) days.set(day, { path: notStoredPath(day) });
  }
  return days;
}
