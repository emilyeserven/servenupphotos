import { useState } from "react";
import { GROUP_KINDS, type GroupKind, type OrganizeResponse } from "@/api/organize";
import type { PublishResult } from "@/api/photos";
import { AllPhotosRebuild, type RebuildWatch } from "@/components/all-photos-rebuild";
import { NewGroupForm } from "@/components/organize-page/new-group-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WaitingForCommit } from "@/components/waiting-for-commit";

interface NewGroupCardProps {
  kind: GroupKind;
  folder: string;
  /** Every album and tag, to warn about a name or ID already taken; undefined until it's read. */
  organize?: OrganizeResponse;
  rebuild: RebuildWatch;
  onSaved: () => void;
}

/** The New album, tag or genre card: its form, then where the saved one went. */
export function NewGroupCard(props: NewGroupCardProps) {
  const { singular } = GROUP_KINDS[props.kind];
  // Bumped by "Add another" to start a fresh form.
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<PublishResult | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New {singular}</CardTitle>
        <CardDescription>
          Saves the {singular} as one JSON file in the app, waiting for Commit. Its name and ID
          can't be used by another album, tag or genre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {saved ? (
          <SavedGroup
            kind={props.kind}
            result={saved}
            rebuild={props.rebuild}
            onAnother={() => {
              setSaved(null);
              setFormKey((n) => n + 1);
            }}
          />
        ) : (
          <NewGroupForm
            key={formKey}
            kind={props.kind}
            folder={props.folder}
            organize={props.organize}
            onSaved={(result) => {
              setSaved(result);
              props.onSaved();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Where the new album or tag went, then how CI's rebuild of the combined file is going. */
function SavedGroup({
  kind,
  result,
  rebuild,
  onAnother,
}: {
  kind: GroupKind;
  result: PublishResult;
  rebuild: RebuildWatch;
  onAnother: () => void;
}) {
  const { singular, allFile } = GROUP_KINDS[kind];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Saved <code>{result.path}</code> in the app.{" "}
        <WaitingForCommit pullRequestUrl={result.pullRequestUrl} />
      </p>
      <AllPhotosRebuild status={rebuild.status} file={allFile} />
      <Button variant="outline" size="sm" className="self-start" onClick={onAnother}>
        Add another {singular}
      </Button>
    </div>
  );
}
