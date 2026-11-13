import { useNavigate } from "@tanstack/react-router";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filter-bar";

/**
 * Which marked photos a Gallery filter shows, such as the Undecided or Lower Tier ones: none until
 * opted in, "show" to show them with the rest, or "only" to show only them.
 */
export type MarkChoice = "show" | "only";

const MARK_CHOICES: ToggleChoices<MarkChoice> = [
  [undefined, "Hidden"],
  ["show", "Shown"],
  ["only", "Only"],
];

/** A mark filter's search param value, or undefined (hidden) for anything else. */
export function parseMarkChoice(value: unknown): MarkChoice | undefined {
  return value === "show" || value === "only" ? value : undefined;
}

/** The files a mark filter lets through, given the paths of the marked ones. */
export function applyMarkChoice<T extends { path: string }>(
  choice: MarkChoice | undefined,
  marked: ReadonlySet<string>,
  files: T[],
): T[] {
  if (choice === "show") return files;
  return files.filter((file) => marked.has(file.path) === (choice === "only"));
}

interface MarkToggleProps {
  label: string;
  /** The Gallery search param the choice is kept in, such as `undecided`. */
  param: "undecided" | "lowerTier";
  choice?: MarkChoice;
}

/** A mark filter's Hidden, Shown and Only buttons, for the Gallery's filter bar. */
export function MarkToggle({ label, param, choice }: MarkToggleProps) {
  const navigate = useNavigate({ from: "/gallery" });
  return (
    <FilterToggle
      label={label}
      choice={choice}
      choices={MARK_CHOICES}
      onChange={(value) =>
        void navigate({
          search: (prev) => ({ ...prev, [param]: value }),
          replace: true,
          resetScroll: false,
        })
      }
    />
  );
}
