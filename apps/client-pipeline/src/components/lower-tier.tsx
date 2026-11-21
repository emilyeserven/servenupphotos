import { ChevronsDownIcon } from "lucide-react";
import { SettingsSwitch } from "@/components/settings-switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isLowerTier } from "@/lib/lower-tier";
import { LOWER_TIER } from "@/lib/photo-fields";
import { editedData } from "@/lib/undecided";
import { cn } from "@/lib/utils";
import { useLocalEditsStore } from "@/stores/local-edits";

/** What Lower Tier means, for tooltips and help text. */
export const LOWER_TIER_HELP =
  "A photo you like and may put in an album or a trip line, but that isn't shown unless you choose to show it.";

/** A photo file the Lower Tier mark is set on or read from. */
interface MarkedFile {
  path: string;
  data?: unknown;
}

/**
 * Sets or clears the Lower Tier mark on each of the files, as a local edit until Commit. Clearing
 * leaves the field out (null) rather than false, so a photo taken out is as it was.
 */
export function useSetLowerTier() {
  const setField = useLocalEditsStore((s) => s.setField);
  return (files: MarkedFile[], lowerTier: boolean) =>
    setField(
      LOWER_TIER,
      files.map((file) => ({
        path: file.path,
        before: (file.data ?? {}) as Record<string, unknown>,
        value: lowerTier ? true : null,
      })),
    );
}

/**
 * The photo file at path's fields waiting for Commit, with any Lower Tier mark set in the Gallery
 * or on the Compare page, for the Photo page to start from (`withLocalLowerTier`).
 */
export function useLocalFields(path: string): Record<string, unknown> | undefined {
  return useLocalEditsStore((s) => s.edits[path]?.fields);
}

/**
 * Drops the Lower Tier mark waiting for Commit on the file at path, once the Photo page saved its
 * JSON (data) with the mark in it.
 */
export function useDropLocalLowerTier() {
  const setField = useLocalEditsStore((s) => s.setField);
  return (path: string, data: Record<string, unknown>) =>
    setField(LOWER_TIER, [{ path, before: data, value: data[LOWER_TIER] ?? null }]);
}

/** Whether the photo is Lower Tier with its local edits made. */
function useIsLowerTier(file: MarkedFile): boolean {
  const edits = useLocalEditsStore((s) => s.edits);
  return isLowerTier(editedData(file, edits));
}

/** "Lower Tier" on a photo marked so, with its local edits made; nothing otherwise. */
export function LowerTierMark({ file, className }: { file: MarkedFile; className?: string }) {
  if (!useIsLowerTier(file)) return null;
  return (
    <span
      title={LOWER_TIER_HELP}
      className={cn(
        "flex w-fit items-center gap-1 text-xs font-normal text-sky-700 dark:text-sky-400",
        className,
      )}
    >
      <ChevronsDownIcon className="size-3.5" aria-hidden />
      Lower Tier
    </span>
  );
}

interface LowerTierCardProps {
  value: boolean;
  onChange: (value: boolean) => void;
  /** Saving is under way, so changing it now would not change the file. */
  disabled: boolean;
}

/**
 * The Photo page's Lower Tier switch. Like Re-edit above it, Save changes writes it into the JSON,
 * so the JSON section shows it and Save changes lights up as soon as it's flipped.
 */
export function LowerTierCard({ value, onChange, disabled }: LowerTierCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lower Tier</CardTitle>
        <CardDescription>
          Saving changes writes it into the JSON&apos;s <code>lowerTier</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={disabled} className="contents">
          <SettingsSwitch
            id="lower-tier"
            config={{
              name: LOWER_TIER,
              label: "Lower Tier photo",
              help: `${LOWER_TIER_HELP} The Gallery hides it until Show → Lower Tier is on.`,
            }}
            value={value}
            onChange={onChange}
          />
        </fieldset>
      </CardContent>
    </Card>
  );
}
