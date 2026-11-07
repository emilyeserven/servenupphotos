import { EyeOff } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StoryItem } from "@/lib/trip-story";

interface StoryPhotoProps {
  item: StoryItem;
  onCaption: (caption: string) => void;
  /** Takes the photo off the Trip page. */
  onLeaveOut: () => void;
}

/** A photo of the story with its caption box and a button that leaves it off the page. */
export function StoryPhotoCard({ item, onCaption, onLeaveOut }: StoryPhotoProps) {
  const name = photoName(item.photo.photo);
  const url = squareUrl(item.photo.photo);
  return (
    <figure className="flex w-40 shrink-0 flex-col gap-1.5">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-md">
        {url && <img src={url} alt={name} className="size-full object-cover" />}
        <Button
          size="icon-sm"
          variant="secondary"
          className="absolute top-1 right-1"
          title="Leave off the Trip page"
          aria-label={`Leave ${name} off the Trip page`}
          onClick={onLeaveOut}
        >
          <EyeOff aria-hidden />
        </Button>
        <span className="bg-background/80 absolute bottom-1 left-1 rounded px-1 text-xs">
          {item.photo.time}
        </span>
      </div>
      <Input
        value={item.caption}
        placeholder="Caption"
        aria-label={`Caption for ${name}`}
        onChange={(event) => onCaption(event.target.value)}
      />
    </figure>
  );
}
