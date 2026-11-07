import { Eye } from "lucide-react";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { type StoryDraft, withItem } from "@/lib/trip-story";

/** The day's photos left off the Trip page, each a button that puts it back. */
export function LeftOut({
  draft,
  onChange,
}: {
  draft: StoryDraft;
  onChange: (draft: StoryDraft) => void;
}) {
  const out = draft.items.filter((item) => !item.shown);
  if (out.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs font-medium">
        Not on the page ({out.length}). Click one to put it back.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {out.map(({ photo }) => (
          <li key={photo.id}>
            <button
              type="button"
              title={`Put ${photoName(photo.photo)} back on the page`}
              className="bg-muted group relative block size-14 overflow-hidden rounded-md opacity-60 hover:opacity-100"
              onClick={() => onChange(withItem(draft, photo.id, { shown: true }))}
            >
              <img
                src={squareUrl(photo.photo)}
                alt={photoName(photo.photo)}
                className="size-full object-cover"
              />
              <Eye
                className="absolute inset-0 m-auto hidden size-5 text-white group-hover:block"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
