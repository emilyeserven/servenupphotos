import { Link } from "@tanstack/react-router";
import { Textarea } from "@/components/ui/textarea";
import { ALT_TEXT_MAX, ALT_TEXT_TARGET, altTextLength } from "@/lib/alt-text";
import { cn } from "@/lib/utils";

interface PhotoAltTextFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * The photo's alt text: a short description of what it shows, saved as the JSON's "altText", which
 * the portfolio gives the photo's images for screen readers and for when they don't load.
 */
export function PhotoAltTextField({ value, disabled, onChange }: PhotoAltTextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="photo-alt-text" className="text-sm font-medium">
          Alt text
        </label>
        <AltTextLength value={value} />
      </div>
      <Textarea
        id="photo-alt-text"
        aria-describedby="photo-alt-text-hint"
        placeholder="What the photo shows, for someone who can't see it: “A paper lantern glowing over a narrow alley at night.”"
        className="max-h-40 min-h-16"
        maxLength={ALT_TEXT_MAX}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id="photo-alt-text-hint" className="text-muted-foreground text-xs">
        Read out by screen readers on the portfolio, and shown when the photo can&apos;t load.
        Without it, the portfolio uses the title. To write it for many photos at once, use{" "}
        <Link to="/alt-text" className="underline underline-offset-4">
          Alt Text
        </Link>
        .
      </p>
    </div>
  );
}

/** How long the alt text is, marked once it's longer than reads well. */
export function AltTextLength({ value }: { value: string }) {
  const length = altTextLength(value);
  const long = length > ALT_TEXT_TARGET;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        long ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
      )}
    >
      {length} / {ALT_TEXT_TARGET}
      {long && " · long for alt text"}
    </span>
  );
}
