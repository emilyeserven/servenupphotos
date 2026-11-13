import { useSearch } from "@tanstack/react-router";
import type { PublishedFile } from "@/api/photos";
import {
  type MarkChoice,
  MarkToggle,
  applyMarkChoice,
  parseMarkChoice,
} from "@/components/gallery/mark-filter";
import { undecidedPaths } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

/** The Gallery's `?undecided=` search param, or undefined (hidden) for anything else. */
export function parseUndecided(search: Record<string, unknown>): MarkChoice | undefined {
  return parseMarkChoice(search.undecided);
}

/**
 * The Gallery's Undecided filter, kept in the URL, and the files it lets through with the local
 * edits made. Undecided photos are hidden until it's changed.
 */
export function useUndecidedFilter() {
  const choice = useSearch({ from: "/gallery", select: parseUndecided });
  const edits = useLocalEditsStore((s) => s.edits);
  return {
    choice,
    apply: (files: PublishedFile[]): PublishedFile[] =>
      applyMarkChoice(choice, undecidedPaths(files, edits), files),
  };
}

/** The Undecided filter's Hidden, Shown and Only buttons, for the Gallery's filter bar. */
export function UndecidedToggle({ choice }: { choice?: MarkChoice }) {
  return <MarkToggle label="Undecided" param="undecided" choice={choice} />;
}
