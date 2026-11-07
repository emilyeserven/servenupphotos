import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { StarIcon } from "lucide-react";
import {
  type Group,
  type GroupKind,
  type OrganizeResponse,
  groupLabel,
  organizeQuery,
  setTagFavoritesMutation,
} from "@/api/organize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Saves whether tags are favorites, reading the tags again after. */
function useFavoriteSave() {
  const queryClient = useQueryClient();
  return useMutation({
    ...setTagFavoritesMutation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey }),
  });
}

/**
 * A star that makes the tag a favorite, or not, as a change waiting for Commit. Favorite tags come
 * first on the Tags page and in the Tags field, and at the top of the portfolio's Tags page.
 * Nothing shows for an album or genre, or a tag whose file couldn't be read.
 */
export function FavoriteTagButton({ kind, tag }: { kind: GroupKind; tag: Group }) {
  if (kind !== "tags" || tag.error) return null;
  return <StarButton tag={tag} />;
}

function StarButton({ tag }: { tag: Group }) {
  const save = useFavoriteSave();
  const favorite = Boolean(tag.favorite);
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={starLabel(tag, favorite)}
        aria-pressed={favorite}
        disabled={save.isPending}
        onClick={() => save.mutate({ [tag.id]: !favorite })}
      >
        <StarIcon aria-hidden className={cn(favorite && FILLED_STAR)} />
      </Button>
      {save.isError && <span className="text-destructive text-xs">{save.error.message}</span>}
    </span>
  );
}

/** A favorite tag's star, filled in. */
const FILLED_STAR = "fill-amber-400 text-amber-500 dark:text-amber-400";

/** What the star does, for a screen reader. */
function starLabel(tag: Group, favorite: boolean): string {
  const name = groupLabel(tag);
  return favorite ? `Unpin ${name} from favorites` : `Pin ${name} to favorites`;
}

/**
 * The favorite tags, at the top of the Tags page, each linking to its page with a star to unpin
 * it. Says how to pin one when there are none.
 */
export function FavoriteTagsCard({ organize }: { organize?: OrganizeResponse }) {
  if (!organize) return null;
  const favorites = organize.tags.filter((tag) => tag.favorite && !tag.error);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Favorite tags</CardTitle>
        <CardDescription>
          Pinned first here and in the Tags field, and shown as Spotlight Tags at the top of the
          portfolio's Tags page. Star a tag below to pin it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? (
          <p className="text-muted-foreground text-sm">No favorite tags yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Favorite tags">
            {favorites.map((tag) => (
              <FavoriteChip key={tag.path} tag={tag} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** One favorite tag, linked to its page, with its star. */
function FavoriteChip({ tag }: { tag: Group }) {
  return (
    <li className="bg-muted/50 flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-sm">
      <Link
        to="/tags/$id"
        params={{ id: tag.id }}
        className="font-medium underline-offset-4 hover:underline"
      >
        {groupLabel(tag)}
      </Link>
      <StarButton tag={tag} />
    </li>
  );
}
