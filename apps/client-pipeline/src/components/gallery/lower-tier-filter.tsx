import { useSearch } from "@tanstack/react-router";
import type { PublishedFile } from "@/api/photos";
import {
  type MarkChoice,
  MarkToggle,
  applyMarkChoice,
  parseMarkChoice,
} from "@/components/gallery/mark-filter";
import { lowerTierPaths } from "@/lib/lower-tier";
import { useLocalEditsStore } from "@/stores/local-edits";

/** The Gallery's `?lowerTier=` search param, or undefined (hidden) for anything else. */
export function parseLowerTier(search: Record<string, unknown>): MarkChoice | undefined {
  return parseMarkChoice(search.lowerTier);
}

/**
 * The Gallery's Lower Tier filter, kept in the URL, and the files it lets through with the local
 * edits made. Lower Tier photos are hidden until it's changed, so they show only when chosen.
 */
export function useLowerTierFilter() {
  const choice = useSearch({ from: "/gallery", select: parseLowerTier });
  const edits = useLocalEditsStore((s) => s.edits);
  return {
    choice,
    apply: (files: PublishedFile[]): PublishedFile[] =>
      applyMarkChoice(choice, lowerTierPaths(files, edits), files),
  };
}

/** The Lower Tier filter's Hidden, Shown and Only buttons, for the Gallery's filter bar. */
export function LowerTierToggle({ choice }: { choice?: MarkChoice }) {
  return <MarkToggle label="Lower Tier" param="lowerTier" choice={choice} />;
}
