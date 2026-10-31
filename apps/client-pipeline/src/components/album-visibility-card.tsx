import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { albumAncestry, type Group, organizeQuery, setAlbumHiddenMutation } from "@/api/organize";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/**
 * Shows or hides the album on the portfolio. A hidden album, and every album inside it, isn't on
 * the portfolio's Albums page, its album filter or its own page; its photos still show elsewhere.
 */
export function AlbumVisibilityCard({ album, albums }: { album: Group; albums: Group[] }) {
  const save = useHiddenSave();
  const hidden = Boolean(album.hidden);
  return (
    <Card>
      <CardHeader>
        <CardTitle>On the portfolio</CardTitle>
        <CardDescription>
          A hidden album isn't on the portfolio's Albums page, album filter or its own page, and
          neither are the albums inside it. Its photos still show everywhere else.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <VisibilityStatus album={album} albums={albums} />
        <div>
          <VisibilityButton
            hidden={hidden}
            pending={save.isPending}
            onClick={() => save.mutate({ id: album.id, hidden: !hidden })}
          />
        </div>
        <VisibilityOutcome save={save} />
      </CardContent>
    </Card>
  );
}

/** Saves whether the album is hidden, reading the albums again after. */
function useHiddenSave() {
  const queryClient = useQueryClient();
  return useMutation({
    ...setAlbumHiddenMutation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey }),
  });
}

/** The button that hides a shown album or shows a hidden one. */
function VisibilityButton({
  hidden,
  pending,
  onClick,
}: {
  hidden: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const Icon = hidden ? EyeIcon : EyeOffIcon;
  return (
    <Button variant="outline" disabled={pending} onClick={onClick}>
      {pending ? <Spinner /> : <Icon />}
      {hidden ? "Show on the portfolio" : "Hide on the portfolio"}
    </Button>
  );
}

/** What saving did, or why it failed. */
function VisibilityOutcome({ save }: { save: ReturnType<typeof useHiddenSave> }) {
  if (save.isError) return <p className="text-destructive">{save.error.message}</p>;
  if (!save.data?.files) return null;
  return (
    <p className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>
        Saved the change in the app. <WaitingForCommit pullRequestUrl={save.data.pullRequestUrl} />
      </span>
    </p>
  );
}

/** Whether the album shows on the portfolio, and which album hides it when one it's inside does. */
function VisibilityStatus({ album, albums }: { album: Group; albums: Group[] }) {
  if (album.hidden) return <p>Hidden on the portfolio.</p>;
  const hiddenParent = albumAncestry(albums, album.id).find((a) => a.id !== album.id && a.hidden);
  if (hiddenParent) {
    return (
      <p>
        Hidden on the portfolio, because it's inside {hiddenParent.name || hiddenParent.id}, which
        is hidden.
      </p>
    );
  }
  return <p>Shown on the portfolio.</p>;
}

/** A note after a hidden album's name in the Albums list. */
export function HiddenMark({ album }: { album: Group }) {
  if (!album.hidden) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
      <EyeOffIcon className="size-3" aria-hidden />
      Hidden on the portfolio
    </span>
  );
}
