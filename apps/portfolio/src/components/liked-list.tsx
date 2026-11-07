import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLikeComments } from "@/lib/likes";
import type { Photo } from "@/lib/photos";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";
import { photoPageUrl } from "@/lib/shown-photo";

/**
 * Where the visitor will send their likes, which decides the text: `discord` for a Markdown list
 * of titles linking to each photo, with their comments, or `text` for only the ids, for
 * Messenger or a text message.
 */
export type LikedListService = "discord" | "text";

/** Each service's button label, in the toggle's order. */
const SERVICES: { value: LikedListService; label: string }[] = [
  { value: "discord", label: "Discord" },
  { value: "text", label: "Messenger / Text" },
];

/** Backslashes `[`, `]` and `\` in a title, so it can't break the Markdown link around it. */
function escapeMarkdown(text: string): string {
  return text.replace(/[[\]\\]/g, "\\$&");
}

/** A photo's title, or "Untitled" for one without. */
function titleOf(photo: Photo): string {
  return photo.title.trim() || "Untitled";
}

/** The comment on one line, after a colon, or nothing for a photo without one. */
function commentSuffix(comment: string | undefined): string {
  const oneLine = comment?.replace(/\s+/g, " ").trim();
  return oneLine ? `: ${oneLine}` : "";
}

/**
 * The Discord text: a Markdown list of each title linking to the photo's own page, followed by
 * the visitor's comment when there is one, such as
 * `- [Shibuya at night](https://servenupphotos.net/photos/12/): love the light`. The pipeline's
 * likes import reads the ids back out of the `/photos/<id>/` links.
 */
function discordText(photos: readonly Photo[], comments: Readonly<Record<string, string>>) {
  return photos
    .map(
      (photo) =>
        `- [${escapeMarkdown(titleOf(photo))}](${photoPageUrl(photo.id)})${commentSuffix(comments[photo.id])}`,
    )
    .join("\n");
}

/** The text to copy for the service: the Discord list, or the ids comma separated, such as `281, 284, 286`. */
function likedListText(
  photos: readonly Photo[],
  service: LikedListService,
  comments: Readonly<Record<string, string>>,
): string {
  if (service === "text") return photos.map((photo) => photo.id).join(", ");
  return discordText(photos, comments);
}

/**
 * My Likes' text to send to the photographer, with a toggle between Discord (titles, links and
 * comments) and Messenger / Text (just the ids), and a **Copy** button.
 */
export function LikedList({
  photos,
  service,
  onService,
}: {
  photos: readonly Photo[];
  service: LikedListService;
  onService: (service: LikedListService) => void;
}) {
  const text = likedListText(photos, service, useLikeComments());
  return (
    <section aria-labelledby="liked-list-title" className="rounded-lg border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="liked-list-title" className="text-sm font-medium">
          Send to the photographer
        </h2>
        <ServiceToggle service={service} onService={onService} />
        <CopyTextButton text={text} />
      </div>
      <textarea
        readOnly
        aria-labelledby="liked-list-title"
        value={text}
        rows={service === "text" ? 2 : Math.min(photos.length, 8)}
        onFocus={(event) => event.target.select()}
        className="mt-2 w-full resize-y rounded-md border bg-background p-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    </section>
  );
}

/** The buttons picking the service the text is for. */
function ServiceToggle({
  service,
  onService,
}: {
  service: LikedListService;
  onService: (service: LikedListService) => void;
}) {
  return (
    <div role="group" aria-label="Message service" className={CONTROL_FRAME}>
      {SERVICES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={service === value}
          onClick={() => onService(value)}
          className={controlButtonClass(service === value)}
        >
          {label}
        </button>
      ))}
    </div>
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
