import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, SparklesIcon, Undo2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { isSmartAlbum, ruleCount, type SmartRules } from "@portfolio/lib/smart-albums";
import type { TimelineLabel } from "@portfolio/lib/timeline-labels";
import { type Group, organizeQuery, setAlbumRulesMutation } from "@/api/organize";
import { GridFilterBar } from "@/components/gallery/grid-filters";
import { PhotoTile } from "@/components/group-photo-grid";
import { DateRules } from "@/components/smart-album/date-rules";
import { type RuleParams, useRuleParams } from "@/components/smart-album/rule-params";
import { RuleList } from "@/components/smart-album/rule-list";
import { SavedInApp } from "@/components/waiting-for-commit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { type CombinedPhoto, currentLists } from "@/lib/group-photos";
import { labelsOf } from "@/lib/smart-album-photos";
import { entriesMatching, type RulePhotos, rulePhotos } from "@/lib/smart-album-rules";
import { useCombinedData } from "@/stores/combined-data";

/** How many of the matching photos the editor shows. */
const PREVIEW_PHOTOS = 12;

/**
 * Makes the album a Smart Album, whose photos are the ones its rules match rather than ones chosen
 * by hand, or edits or drops its rules. The rules are the portfolio Grid's filters plus a timeline
 * label and the first and last days, and they're worked out again whenever the photos change.
 */
export function SmartAlbumCard({ album }: { album: Group }) {
  const [editing, setEditing] = useState(false);
  const rules = useRuleParams();
  const save = useRulesSave(() => {
    rules.clear();
    setEditing(false);
  });
  const edit = () => {
    save.reset();
    rules.start(album.rules);
    setEditing(true);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-4" aria-hidden />
          Smart Album
        </CardTitle>
        <CardDescription>
          A Smart Album's photos are every photo its rules match, using the portfolio Grid's
          filters, so new photos join it on their own. It has only those: no photos added by hand,
          and no custom covers or layout.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {editing ? (
          <RuleEditor
            album={album}
            rules={rules}
            save={save}
            onCancel={() => {
              rules.clear();
              setEditing(false);
            }}
          />
        ) : (
          <SavedRules album={album} save={save} onEdit={edit} />
        )}
        <RulesOutcome save={save} />
      </CardContent>
    </Card>
  );
}

/** Saves the album's rules, reading the albums again after, then calls onSaved. */
function useRulesSave(onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    ...setAlbumRulesMutation,
    onSuccess: () => {
      onSaved();
      return queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey });
    },
  });
}

type RulesSave = ReturnType<typeof useRulesSave>;

/** The album's saved rules and the buttons to edit or drop them, or to give it some. */
function SavedRules({
  album,
  save,
  onEdit,
}: {
  album: Group;
  save: RulesSave;
  onEdit: () => void;
}) {
  const labels = useCombinedLabels();
  if (!isSmartAlbum(album)) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p>This album's photos are chosen by hand.</p>
        <Button variant="outline" onClick={onEdit}>
          <SparklesIcon />
          Pick its photos with rules
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <RuleList rules={album.rules ?? {}} labels={labels} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit}>
          <PencilIcon />
          Edit rules
        </Button>
        <Button
          variant="outline"
          disabled={save.isPending}
          onClick={() => save.mutate({ id: album.id, rules: null })}
        >
          {save.isPending ? <Spinner /> : <Undo2Icon />}
          Stop using rules
        </Button>
      </div>
    </div>
  );
}

/** The timeline labels in the combined lists, with the changes waiting for Commit; none until read. */
function useCombinedLabels(): TimelineLabel[] {
  const { data } = useCombinedData();
  return data ? labelsOf(currentLists(data)) : [];
}

interface RuleEditorProps {
  album: Group;
  rules: RuleParams;
  save: RulesSave;
  onCancel: () => void;
}

/** The rules being edited, the photos they match, and the buttons to save them or cancel. */
function RuleEditor({ album, rules, save, onCancel }: RuleEditorProps) {
  const combined = useCombinedData();
  const tried = useMemo(() => rulePhotos(combined.data), [combined.data]);
  if (!tried) return <p>Reading ALLPHOTOS.json…</p>;
  const count = ruleCount(rules.draft);
  return (
    <>
      <DateRules rules={rules} labels={tried.labels} />
      <GridFilterBar photos={tried.photos} />
      <MatchPreview tried={tried} rules={rules.draft} count={count} />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={count === 0 || save.isPending}
          onClick={() => save.mutate({ id: album.id, rules: rules.draft })}
        >
          {save.isPending && <Spinner />}
          Save rules
        </Button>
        <Button variant="outline" disabled={save.isPending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

/** How many photos the rules match, and the first of them; a prompt while no rule is set. */
function MatchPreview({
  tried,
  rules,
  count,
}: {
  tried: RulePhotos;
  rules: SmartRules;
  count: number;
}) {
  if (count === 0) {
    return (
      <p className="text-muted-foreground">
        Set a timeline label, a day or one of the filters to pick the album's photos.
      </p>
    );
  }
  const matching = entriesMatching(tried, rules);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-medium">
        {count === 1 ? "1 rule matches" : `${count} rules match`} {photoCount(matching.length)}
        {matching.length > PREVIEW_PHOTOS && `, the first ${PREVIEW_PHOTOS} shown`}.
      </p>
      <PreviewTiles photos={matching.slice(0, PREVIEW_PHOTOS)} />
    </div>
  );
}

function photoCount(count: number): string {
  return count === 1 ? "1 photo" : `${count} photos`;
}

function PreviewTiles({ photos }: { photos: CombinedPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))]">
      {photos.map((photo, i) => (
        <li key={`${String(photo.file)}-${i}`}>
          <PhotoTile photo={photo} />
        </li>
      ))}
    </ul>
  );
}

/** What saving did, or why it failed. */
function RulesOutcome({ save }: { save: RulesSave }) {
  if (save.isError) return <p className="text-destructive">{save.error.message}</p>;
  if (!save.data?.files) return null;
  return <SavedInApp what="the rules" pullRequestUrl={save.data.pullRequestUrl} />;
}

/** A note after a Smart Album's name in the Albums list. */
export function SmartMark({ album }: { album: Group }) {
  if (!isSmartAlbum(album)) return null;
  return (
    <span className="text-muted-foreground ml-2 inline-flex items-center gap-1 text-xs">
      <SparklesIcon className="size-3" aria-hidden />
      Smart Album
    </span>
  );
}
