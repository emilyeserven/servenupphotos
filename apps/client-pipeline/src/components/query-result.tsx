import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface QueryResultProps<T> {
  query: UseQueryResult<T>;
  pendingLabel?: string;
  /** Shown while pending instead of `pendingLabel`, such as a progress bar. */
  pending?: ReactNode;
  children: (data: T) => ReactNode;
}

/** Renders the pending / error / success states of a TanStack Query result. */
export function QueryResult<T>({
  query,
  pendingLabel = "Loading…",
  pending = <p>{pendingLabel}</p>,
  children,
}: QueryResultProps<T>) {
  if (query.isPending) return pending;
  if (query.isError) return <p className="text-destructive">{query.error.message}</p>;
  return children(query.data);
}
