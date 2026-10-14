import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface QueryResultProps<T> {
  query: UseQueryResult<T>;
  pendingLabel?: string;
  children: (data: T) => ReactNode;
}

/** Renders the pending / error / success states of a TanStack Query result. */
export function QueryResult<T>({
  query,
  pendingLabel = "Loading…",
  children,
}: QueryResultProps<T>) {
  if (query.isPending) return <p>{pendingLabel}</p>;
  if (query.isError) return <p className="text-destructive">{query.error.message}</p>;
  return children(query.data);
}
