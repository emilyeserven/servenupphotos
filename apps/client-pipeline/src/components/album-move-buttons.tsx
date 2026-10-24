import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { type Group, groupLabel, organizeQuery, setAlbumOrderMutation } from "@/api/organize";
import { Button } from "@/components/ui/button";
import { movedAlbumOrder } from "@/lib/album-order";

interface AlbumMoveButtonsProps {
  album: Group;
  /** Every album, in its order; undefined for a tag, which has no order. */
  albums?: Group[];
}

/**
 * Moves an album one place up or down among the albums in the same parent, saving every album's
 * place as its `order`, a change waiting for Commit. The portfolio lists albums in this order.
 * Nothing shows for a tag, or an album whose file couldn't be read.
 */
export function AlbumMoveButtons({ album, albums }: AlbumMoveButtonsProps) {
  if (!albums || album.error) return null;
  return <MoveButtons album={album} albums={albums} />;
}

function MoveButtons({ album, albums }: Required<AlbumMoveButtonsProps>) {
  const queryClient = useQueryClient();
  const save = useMutation({
    ...setAlbumOrderMutation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey }),
  });
  const up = movedAlbumOrder(albums, album.id, -1);
  const down = movedAlbumOrder(albums, album.id, 1);
  const name = groupLabel(album);
  return (
    <span className="flex shrink-0 gap-0.5">
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Move ${name} up`}
        disabled={save.isPending || up.length === 0}
        onClick={() => save.mutate(up)}
      >
        <ArrowUpIcon aria-hidden />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label={`Move ${name} down`}
        disabled={save.isPending || down.length === 0}
        onClick={() => save.mutate(down)}
      >
        <ArrowDownIcon aria-hidden />
      </Button>
      {save.isError && <span className="text-destructive text-xs">{save.error.message}</span>}
    </span>
  );
}
