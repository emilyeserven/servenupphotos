import type { ReactNode } from "react";

import { ErrorNote } from "@/components/error-note";

/**
 * A read that QueryResult can show: a TanStack Query result, or a hook shaped like one, such as
 * `useCombinedData` or `useSessionData`.
 */
interface Read<T> {
  /** True until the read first answers. */
  isPending: boolean;
  /** True when the read failed. A hook without it fails when `data` never arrives. */
  isError?: boolean;
  /** Why the read failed. */
  error?: Error | null;
  /** What was read, once it has been. */
  data: T | undefined;
}

type QueryResultProps<T> = {
  query: Read<T>;
  children: (data: T) => ReactNode;
  /** Whether GitHub's answer starts open when the read fails, as on the Changelog. */
  githubOpen?: boolean;
} & (
  | {
      /** What's being read, always starting with "Reading" and naming it, such as "Reading the photo JSON…". */
      pendingLabel: string;
      pending?: never;
    }
  | {
      /** Shown while pending instead of a label, such as a progress bar or the photo tiles' placeholders. */
      pending: ReactNode;
      pendingLabel?: never;
    }
);

/**
 * The one way a page or card shows a read: "Reading …" while it's pending, `ErrorNote` when it
 * fails, and `children` with the data once it's there.
 */
export function QueryResult<T>({
  query,
  pendingLabel,
  pending,
  children,
  githubOpen,
}: QueryResultProps<T>) {
  if (query.isPending) return pendingView(pending, pendingLabel);
  const data = query.isError ? undefined : query.data;
  if (data === undefined) return <ErrorNote error={readError(query)} githubOpen={githubOpen} />;
  return children(data);
}

/** What shows while the read is pending: `pending` when given, or else the label. */
function pendingView(pending: ReactNode, label: string | undefined): ReactNode {
  return pending ?? <ReadingNote label={label} />;
}

/** Why the read failed, or a plain sentence when the read gave no reason. */
function readError(query: Read<unknown>): Error | string {
  return query.error ?? "This couldn't be read.";
}

/** The words shown while something is read, such as "Reading the photo JSON…". */
export function ReadingNote({ label }: { label: string | undefined }) {
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {label}
    </p>
  );
}
