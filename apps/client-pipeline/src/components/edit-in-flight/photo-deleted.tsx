import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import type { DeletePhotoResult } from "@/api/photos";
import { ImageOutcome, VersionsNotice } from "@/components/remove-in-flight-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaitingForCommit } from "@/components/waiting-for-commit";
import { fileName } from "@/components/edit-in-flight/photo-json";
import { EmptyNote } from "@portfolio/components/empty-note";

/** What deleting a photo did, shown on the Photo page in place of its editor. */
export function PhotoDeleted({ result }: { result: DeletePhotoResult }) {
  const others = result.changes.filter((change) => change.path !== result.path);
  return (
    <Card role="status">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          Deleted {fileName(result.path)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          Deleted its JSON in the app. <WaitingForCommit pullRequestUrl={result.pullRequestUrl} />
        </p>
        <OtherFiles paths={others.map((change) => change.path)} />
        <ImageOutcome image={result.image} />
        <VersionsNotice versions={result.image.versions} />
        {result.original && (
          <>
            <ImageOutcome image={result.original} />
            <VersionsNotice versions={result.original.versions} />
          </>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/gallery">
              <ArrowLeftIcon />
              Gallery
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/in-flight">Photos in Flight</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** The other files the delete took the photo out of; nothing when none pointed at it. */
function OtherFiles({ paths }: { paths: string[] }) {
  if (paths.length === 0) return <EmptyNote>Nothing else pointed at it.</EmptyNote>;
  return (
    <div className="flex flex-col gap-1">
      <p>
        Took it out of {paths.length === 1 ? "1 other file" : `${paths.length} other files`}, also
        waiting for Commit:
      </p>
      <ul className="text-muted-foreground list-disc pl-5 font-mono text-xs">
        {paths.map((path) => (
          <li key={path}>{path.split("/").slice(-2).join("/")}</li>
        ))}
      </ul>
    </div>
  );
}
