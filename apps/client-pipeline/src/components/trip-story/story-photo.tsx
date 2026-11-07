import { Captions, EyeOff, PanelLeft, PanelRight } from "lucide-react";
import type { ComponentType } from "react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { StoryText } from "@/components/trip-story/story-text";
import { Button } from "@/components/ui/button";
import { photoText } from "@/lib/group-photos";
import type { StoryItem, TextSide } from "@/lib/trip-story";
import { cn } from "@/lib/utils";

interface StoryPhotoProps {
  item: StoryItem;
  onChange: (change: Partial<StoryItem>) => void;
}

/**
 * A photo of the story with its text: where it goes (under it, or to its left or right), whether
 * it's the photo's Comment, and the text itself, with a button that leaves the photo off the page.
 */
export function StoryPhotoCard({ item, onChange }: StoryPhotoProps) {
  const name = photoName(item.photo.photo);
  const url = squareUrl(item.photo.photo);
  return (
    <figure className="flex w-60 shrink-0 flex-col gap-1.5">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-md">
        {url && <img src={url} alt={name} className="size-full object-cover" />}
        <Button
          size="icon-sm"
          variant="secondary"
          className="absolute top-1 right-1"
          title="Leave off the Trip page"
          aria-label={`Leave ${name} off the Trip page`}
          onClick={() => onChange({ shown: false, withNext: false })}
        >
          <EyeOff aria-hidden />
        </Button>
        <span className="bg-background/80 absolute bottom-1 left-1 rounded px-1 text-xs">
          {item.photo.time}
        </span>
      </div>
      <SidePicker side={item.textSide} onChange={(textSide) => onChange({ textSide })} />
      <PhotoText item={item} onChange={onChange} />
    </figure>
  );
}

/** Each place a photo's text can go, with its icon and what it's called. */
const SIDES: { side: TextSide; label: string; Icon: ComponentType }[] = [
  { side: "caption", label: "Caption under it", Icon: Captions },
  { side: "left", label: "Paragraph on its left", Icon: PanelLeft },
  { side: "right", label: "Paragraph on its right", Icon: PanelRight },
];

/** Where the photo's text goes: under it as a caption, or as a paragraph to its left or right. */
function SidePicker({ side, onChange }: { side: TextSide; onChange: (side: TextSide) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Where its text goes">
      {SIDES.map(({ side: s, label, Icon }) => (
        <Button
          key={s}
          size="icon-sm"
          variant="ghost"
          title={label}
          aria-label={label}
          aria-pressed={side === s}
          className={cn(side === s && "bg-muted")}
          onClick={() => onChange(s)}
        >
          <Icon aria-hidden />
        </Button>
      ))}
      <span className="text-muted-foreground ml-1 text-xs">
        {SIDES.find((x) => x.side === side)?.label}
      </span>
    </div>
  );
}

/** The photo's text: its Comment from the Photo page, when chosen, or else its own Markdown. */
function PhotoText({ item, onChange }: StoryPhotoProps) {
  const comment = photoText(item.photo.photo, "comment");
  return (
    <div className="flex flex-col gap-1">
      {comment && (
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={item.useComment}
            onChange={(event) => onChange({ useComment: event.target.checked })}
          />
          Use the photo&apos;s Comment
        </label>
      )}
      {item.useComment && comment ? (
        <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-line">{comment}</p>
      ) : (
        <StoryText
          label="Its text"
          addLabel="Add text"
          value={item.text}
          onChange={(text) => onChange({ text })}
        />
      )}
    </div>
  );
}
