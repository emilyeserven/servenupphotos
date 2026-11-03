import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLikeComments } from "@/lib/likes";
import type { Photo } from "@/lib/photos";
import { photoPageUrl } from "@/lib/shown-photo";

/** What the copyable list adds to each title. */
export interface LikedListOptions {
  /** Set to make each title a Markdown link to the photo's own page. */
  links: boolean;
  /** Set to add the visitor's own comment after each title that has one. */
  comments: boolean;
  /**
   * Set to list only the photos' ids, comma separated, such as `281, 284, 286`, for the visitor to
   * send to the photographer, who adds them up on the pipeline. Links and comments are left out.
   */
  photographer: boolean;
}

/** Backslashes `[`, `]` and `\` in a title, so it can't break the Markdown link around it. */
function escapeMarkdown(text: string): string {
  return text.replace(/[[\]\\]/g, "\\$&");
}

/** A photo's title, or "Untitled" for one without. */
function titleOf(photo: Photo): string {
  return photo.title.trim() || "Untitled";
}

/** The title as a Markdown list item linking to the photo's own page. */
function linkedTitle(photo: Photo): string {
  return `- [${escapeMarkdown(titleOf(photo))}](${photoPageUrl(photo.id)})`;
}

/** The comment on one line, after a colon, or nothing for a photo without one. */
function commentSuffix(comment: string | undefined): string {
  const oneLine = comment?.replace(/\s+/g, " ").trim();
  return oneLine ? `: ${oneLine}` : "";
}

/**
 * The liked photos as text to copy: one title per line, or with links, a Markdown list of links to
 * each photo's own page, such as `- [Shibuya at night](https://servenupphotos.net/photos/12/)`.
 * With comments, each title with a comment is followed by it, as `Title: comment`.
 */
function titleListText(
  photos: readonly Photo[],
  options: LikedListOptions,
  comments: Readonly<Record<string, string>>,
): string {
  const title = options.links ? linkedTitle : titleOf;
  const suffix = (photo: Photo) => (options.comments ? commentSuffix(comments[photo.id]) : "");
  return photos.map((photo) => title(photo) + suffix(photo)).join("\n");
}

/** The text to copy: the photos' ids for the photographer, or else their titles. */
function likedListText(
  photos: readonly Photo[],
  options: LikedListOptions,
  comments: Readonly<Record<string, string>>,
): string {
  if (options.photographer) return photos.map((photo) => photo.id).join(", ");
  return titleListText(photos, options, comments);
}

/** The list's heading, saying what the text is. */
function listHeading({ photographer, links }: LikedListOptions): string {
  if (photographer) return "Photo IDs for the photographer";
  return links ? "Markdown list" : "Titles";
}

/**
 * My Likes' list of the liked photos' titles, with a **Copy** button and checkboxes that turn it
 * into a Markdown list of links, add the visitor's comments, or make it the photos' ids to send
 * to the photographer.
 */
export function LikedList({
  photos,
  options,
  onOptions,
}: {
  photos: readonly Photo[];
  options: LikedListOptions;
  onOptions: (options: LikedListOptions) => void;
}) {
  const text = likedListText(photos, options, useLikeComments());
  return (
    <section aria-labelledby="liked-list-title" className="rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="liked-list-title" className="text-sm font-medium">
          {listHeading(options)}
        </h2>
        <Checkbox
          label="Include links"
          checked={options.links}
          disabled={options.photographer}
          onChange={(links) => onOptions({ ...options, links })}
        />
        <Checkbox
          label="Include my comments"
          checked={options.comments}
          disabled={options.photographer}
          onChange={(comments) => onOptions({ ...options, comments })}
        />
        <Checkbox
          label="Send to photographer"
          checked={options.photographer}
          onChange={(photographer) => onOptions({ ...options, photographer })}
        />
        <CopyTextButton text={text} />
      </div>
      <textarea
        readOnly
        aria-labelledby="liked-list-title"
        value={text}
        rows={options.photographer ? 2 : Math.min(photos.length, 8)}
        onFocus={(event) => event.target.select()}
        className="mt-2 w-full resize-y rounded-md border bg-background p-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </section>
  );
}

/** A labelled checkbox for one of the list's options, dimmed when disabled. */
function Checkbox({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground has-disabled:opacity-50">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}

/** Copies the text, then shows "Copied" for a moment. */
function CopyTextButton({ text }: { text: string }) {
  const [justCopied, setJustCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-auto"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setJustCopied(true);
          setTimeout(() => setJustCopied(false), 2000);
        });
      }}
    >
      {justCopied ? <CheckIcon /> : <CopyIcon />}
      {justCopied ? "Copied" : "Copy"}
    </Button>
  );
}
