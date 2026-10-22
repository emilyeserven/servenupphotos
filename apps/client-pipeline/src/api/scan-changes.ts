/** A photo file a bulk save changed, as the backend answers: its data before and after. */
export interface ScanChange {
  path: string;
  before: unknown;
  after: unknown;
}

/**
 * The photo files a bulk save changed, as changes the combined data store makes over ALLPHOTOS.json
 * until it's committed.
 */
export function photoChanges(result: { changes?: ScanChange[] }) {
  return (result.changes ?? []).map((change) => ({ kind: "photos" as const, ...change }));
}
