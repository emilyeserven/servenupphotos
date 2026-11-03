import { useState } from "react";
import type { TagLibraryExport } from "@/api/tag-library";
import type { SaveChange } from "@/components/small-tags/page";
import { AddToPhotos } from "@/components/small-tags/add-to-photos";
import { type PhotosById, TaggedPhotos } from "@/components/small-tags/small-photos";
import { RemoveTag, RenameTag } from "@/components/small-tags/tag-actions";
import { ErrorText } from "@/components/bulk-tagging/pick-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { count } from "@/components/update-data-shared";
import type { SmallTag } from "@/lib/small-tags";

/** What can be done to a small tag, one at a time. */
const ACTIONS = [
  { id: "remove", label: "Remove" },
  { id: "rename", label: "Rename or merge" },
  { id: "add", label: "Add to more photos" },
] as const;

type Action = (typeof ACTIONS)[number]["id"];

/** The props every action's form takes. */
export interface ActionProps {
  small: SmallTag;
  library: TagLibraryExport;
  photos: PhotosById;
  pending: boolean;
  onSave: SaveChange;
}

/** A small tag's card's props: an action's, and why its last save failed, if it did. */
interface SmallTagCardProps extends ActionProps {
  error: Error | null;
}

/** One small tag: where it sits, its photos, and the buttons that open each action's form. */
export function SmallTagCard({ error, ...props }: SmallTagCardProps) {
  const { small, photos } = props;
  const [action, setAction] = useState<Action | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono">{small.tag}</CardTitle>
        <CardDescription>
          <TagSummary small={small} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TaggedPhotos photos={small.tagged} byId={photos} />
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Button
              key={a.id}
              type="button"
              size="sm"
              variant={action === a.id ? "secondary" : "outline"}
              aria-pressed={action === a.id}
              onClick={() => setAction(action === a.id ? null : a.id)}
            >
              {a.label}
            </Button>
          ))}
        </div>
        {action === "remove" && <RemoveTag {...props} />}
        {action === "rename" && <RenameTag {...props} />}
        {action === "add" && <AddToPhotos {...props} />}
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}

/** How many photos a small tag shows, where it sits and what's under it, and its description. */
function TagSummary({ small }: { small: SmallTag }) {
  const where = small.parent ? `Under ${small.parent}` : "At the top level";
  const under = small.children.length > 0 ? `, with ${small.children.join(", ")} under it` : "";
  return (
    <>
      {count(small.shown, "photo")}. {where}
      {under}.{small.description && <> {small.description}</>}
    </>
  );
}
