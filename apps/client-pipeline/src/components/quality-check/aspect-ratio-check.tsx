import { useMutation } from "@tanstack/react-query";
import { RatioIcon } from "lucide-react";
import { useMemo } from "react";
import { imageSizesMutation } from "@/api/image-sizes";
import { FlagList } from "@/components/quality-check/flag-list";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { count } from "@/components/update-data-shared";
import { type AspectCheck, checkAspectRatios } from "@/lib/aspect-ratio";
import type { AutogroupPhoto } from "@/lib/compare-autogroup";

/**
 * The aspect ratio check: measures every chosen photo's Small version on the backend and lists
 * the ones that aren't 16:9 (landscape) or 5:7 (portrait), within 1%, to flag for re-edit.
 */
export function AspectRatioCheck({ photos }: { photos: AutogroupPhoto[] }) {
  const measure = useMutation(imageSizesMutation);
  const result = useMemo(
    () => measure.data && checkAspectRatios(photos, measure.data.images),
    [photos, measure.data],
  );
  const urls = [...new Set(photos.map((entry) => entry.imageUrl))];
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium">Aspect ratios</h3>
      <p className="text-muted-foreground max-w-prose text-sm">
        Reads each photo&apos;s Small version and lists the ones that aren&apos;t the house crop:
        16:9 for a landscape photo and 5:7 for a portrait one, within 1%. A square photo is neither.
      </p>
      <CheckButton
        label={result ? "Check again" : `Check ${count(photos.length, "photo")}`}
        pending={measure.isPending}
        disabled={urls.length === 0}
        onClick={() => measure.mutate({ urls })}
      />
      {measure.error && <p className="text-destructive text-sm">{measure.error.message}</p>}
      {result && <AspectResult result={result} />}
    </section>
  );
}

interface CheckButtonProps {
  label: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}

/** The button that measures the Small versions, with a spinner while it runs. */
function CheckButton({ label, pending, disabled, onClick }: CheckButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={disabled || pending}
      onClick={onClick}
    >
      {pending ? <Spinner /> : <RatioIcon />}
      {label}
    </Button>
  );
}

/** How many photos the check found off the house ratios, of the ones it could read. */
function foundText({ items, read }: AspectCheck<AutogroupPhoto>): string {
  if (items.length === 0) return `Every one of ${count(read, "photo")} is a house ratio.`;
  return `${count(items.length, "photo")} of ${read} ${items.length === 1 ? "isn't" : "aren't"} a house ratio.`;
}

/** What the check found: how many are off, the list to flag, and what couldn't be read. */
function AspectResult({ result }: { result: AspectCheck<AutogroupPhoto> }) {
  const { items, unread } = result;
  return (
    <>
      <p className="text-sm">{foundText(result)}</p>
      {items.length > 0 && <FlagList items={items} linkLabel="Open the photo" />}
      {unread.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {count(unread.length, "photo")} couldn&apos;t be checked because their Small version
          couldn&apos;t be read: {unread.map((entry) => entry.key).join(", ")}.
        </p>
      )}
    </>
  );
}
