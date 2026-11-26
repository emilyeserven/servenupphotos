import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import {
  GROUP_KINDS,
  type Group,
  type GroupKind,
  type OrganizeResponse,
  albumDescendants,
  organizeQuery,
  setGroupParentMutation,
} from "@/api/organize";
import { AllPhotosRebuild, useAllPhotosRebuild } from "@/components/all-photos-rebuild";
import { ErrorNote } from "@/components/error-note";
import { GroupCombobox } from "@/components/photo-groups-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { WaitingForCommit } from "@/components/waiting-for-commit";

/** How the parent card describes each kind's parent. */
const PARENT_TEXT: Record<GroupKind, { title: string; description: string; none: string }> = {
  albums: {
    title: "Parent album",
    description: "An album can be inside one other album.",
    none: "None: a top-level album",
  },
  tags: {
    title: "Parent tag",
    description:
      "A tag can be under one more general tag, such as shotengai under covered-street, so filtering by the parent shows its photos too.",
    none: "None: a top-level tag",
  },
  genres: {
    title: "Parent genre",
    description:
      "A genre can be a subgenre of one broader genre, such as Traditional architecture under Architecture, so filtering by the parent shows its photos too. To arrange every genre at once, use Reorganize Genres.",
    none: "None: a top-level genre",
  },
};

/** Picks the album's, tag's or genre's one parent, leaving out itself and the ones under it, and saves it. */
export function ParentCard({
  kind,
  group,
  organize,
}: {
  kind: GroupKind;
  group: Group;
  organize: OrganizeResponse;
}) {
  const saved = group.parent ? [group.parent] : [];
  const [parent, setParent] = useState<string[]>(saved);
  const { save, rebuild } = useParentSave(kind, Boolean(organize.pullRequest));
  const exclude = new Set([group.id, ...albumDescendants(organize[kind], group.id)]);
  const text = PARENT_TEXT[kind];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>
          {text.description} Saving changes its file as a change waiting for Commit.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <GroupCombobox
          id={`${kind}-parent`}
          kind={kind}
          multiple={false}
          value={parent}
          exclude={exclude}
          disabled={save.isPending}
          placeholder={text.none}
          onChange={(next) => {
            save.reset();
            setParent(next);
          }}
        />
        <ParentButtons
          changed={parentChanged(parent, group)}
          pending={save.isPending}
          onSave={() => save.mutate({ id: group.id, parent: parent[0] ?? null })}
          onUndo={() => setParent(saved)}
        />
        <ParentOutcome save={save} rebuild={rebuild} kind={kind} />
      </CardContent>
    </Card>
  );
}

function parentChanged(parent: string[], album: Group): boolean {
  return (parent[0] ?? "") !== (album.parent ?? "");
}

/** Saves an album's or tag's parent, reading them again and following CI's rebuild after a change. */
function useParentSave(kind: GroupKind, hasPullRequest: boolean) {
  const { refetch } = useQuery(organizeQuery);
  const rebuild = useAllPhotosRebuild(hasPullRequest, () => {});
  const save = useMutation({
    ...setGroupParentMutation(kind),
    onSuccess: (result) => {
      if (!result.changed) return;
      void refetch();
      rebuild.afterPush();
    },
  });
  return { save, rebuild, kind };
}

type ParentSave = ReturnType<typeof useParentSave>;

interface ParentButtonsProps {
  changed: boolean;
  pending: boolean;
  onSave: () => void;
  onUndo: () => void;
}

function ParentButtons({ changed, pending, onSave, onUndo }: ParentButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={!changed || pending} onClick={onSave}>
        {pending && <Spinner />}
        Save parent
      </Button>
      {changed && (
        <Button variant="outline" disabled={pending} onClick={onUndo}>
          Undo
        </Button>
      )}
    </div>
  );
}

/** What saving the parent did, or why it failed. */
function ParentOutcome({ save, rebuild, kind }: ParentSave) {
  if (save.isError) return <ErrorNote error={save.error} />;
  if (!save.isSuccess) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-start gap-2">
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>
          <ParentSavedText result={save.data} />
        </span>
      </p>
      {save.data.changed && (
        <AllPhotosRebuild status={rebuild.status} file={GROUP_KINDS[kind].allFile} />
      )}
    </div>
  );
}

function ParentSavedText({ result }: { result: NonNullable<ParentSave["save"]["data"]> }) {
  if (!result.changed) return "It already had that parent, so nothing changed.";
  return (
    <>
      Saved the change in the app. <WaitingForCommit pullRequestUrl={result.pullRequestUrl} />
    </>
  );
}
