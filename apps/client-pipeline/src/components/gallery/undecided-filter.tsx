import { useNavigate, useSearch } from "@tanstack/react-router";
import type { PublishedFile } from "@/api/photos";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import { undecidedPaths } from "@/lib/undecided";
import { useLocalEditsStore } from "@/stores/local-edits";

/**
 * Which Undecided photos the Gallery shows: none until opted in, "show" to show them with the
 * rest, or "only" to show only them.
 */
export type UndecidedChoice = "show" | "only";

const UNDECIDED_CHOICES: ToggleChoices<UndecidedChoice> = [
  [undefined, "Hidden"],
  ["show", "Shown"],
  ["only", "Only"],
];

/** The Gallery's `?undecided=` search param, or undefined (hidden) for anything else. */
export function parseUndecided(search: Record<string, unknown>): UndecidedChoice | undefined {
  const value = search.undecided;
  return value === "show" || value === "only" ? value : undefined;
}

/** Whether a photo passes the Undecided filter, given whether it's Undecided. */
function passes(choice: UndecidedChoice | undefined, undecided: boolean): boolean {
  if (choice === "show") return true;
  return undecided === (choice === "only");
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
    apply: (files: PublishedFile[]): PublishedFile[] => {
      const undecided = undecidedPaths(files, edits);
      return files.filter((file) => passes(choice, undecided.has(file.path)));
    },
  };
}

/** The Undecided filter's Hidden, Shown and Only buttons, for the Gallery's filter bar. */
export function UndecidedToggle({ choice }: { choice?: UndecidedChoice }) {
  const navigate = useNavigate({ from: "/gallery" });
  return (
    <FilterToggle
      label="Undecided"
      choice={choice}
      choices={UNDECIDED_CHOICES}
      onChange={(undecided) =>
        void navigate({
          search: (prev) => ({ ...prev, undecided }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
