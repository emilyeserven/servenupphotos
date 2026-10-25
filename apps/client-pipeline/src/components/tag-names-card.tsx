import { useMutation } from "@tanstack/react-query";
import {
  type OrganizeResponse,
  groupLabel,
  normalizeTagNamesMutation,
  unnormalizedTags,
} from "@/api/organize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface TagNamesCardProps {
  /** Every album and tag; undefined until it's read. */
  organize?: OrganizeResponse;
  onSaved: () => void;
}

/**
 * Lists the tags whose names aren't in lowercase kebab-case yet, such as ones made before tag
 * names had to be, with a button that renames them all to their IDs. Hidden when there are none.
 */
export function TagNamesCard({ organize, onSaved }: TagNamesCardProps) {
  const tags = unnormalizedTags(organize);
  if (tags.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag names to fix</CardTitle>
        <CardDescription>
          Tag names are lowercase kebab-case, the same as their IDs. Renaming these saves each name
          as its ID, as changes waiting for Commit. Photos list tags by ID, so none of them change.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <ul className="flex flex-col gap-1">
          {tags.map((tag) => (
            <li key={tag.id}>
              {groupLabel(tag)} → <code>{tag.id}</code>
            </li>
          ))}
        </ul>
        <RenameButton count={tags.length} onSaved={onSaved} />
      </CardContent>
    </Card>
  );
}

/** Renames every tag whose name isn't its ID, saying why when it can't. */
function RenameButton({ count, onSaved }: { count: number; onSaved: () => void }) {
  const normalize = useMutation({ ...normalizeTagNamesMutation, onSuccess: onSaved });
  return (
    <>
      <Button
        type="button"
        className="self-start"
        disabled={normalize.isPending}
        onClick={() => normalize.mutate()}
      >
        {normalize.isPending && <Spinner />}
        Rename {count === 1 ? "1 tag" : `${count} tags`}
      </Button>
      {normalize.isError && <p className="text-destructive">{normalize.error.message}</p>}
    </>
  );
}
