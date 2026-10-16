import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type AllPhotosCheck, type PhotoIdentity, allPhotosCheckQuery } from "@/api/photos";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface AllPhotosGateProps {
  /** The analyzed photo, or null when its EXIF couldn't be read and it can't be checked. */
  photo: PhotoIdentity | null;
  /** What can be done with the photo, shown only once it is known not to be in ALLPHOTOS.json. */
  children: ReactNode;
}

/**
 * Checks ALLPHOTOS.json for the analyzed photo before anything can be done with it. A photo already
 * there can't be uploaded or saved again, since editing a saved photo isn't supported yet. When the
 * check can't run, its actions are still offered, with a warning.
 */
export function AllPhotosGate({ photo, children }: AllPhotosGateProps) {
  if (!photo) return children;
  return <Gate photo={photo}>{children}</Gate>;
}

function Gate({ photo, children }: { photo: PhotoIdentity; children: ReactNode }) {
  const check = useQuery(allPhotosCheckQuery(photo));
  if (check.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner />
        Checking ALLPHOTOS.json for this photo…
      </p>
    );
  }
  if (check.isError) {
    return (
      <>
        <Warning>
          Couldn't check ALLPHOTOS.json, so make sure this photo isn't already in it:{" "}
          {check.error.message}
        </Warning>
        {children}
      </>
    );
  }
  if (check.data.matches.length > 0) return <AlreadyThere file={photo.file} check={check.data} />;
  return (
    <>
      <SourceProblems check={check.data} />
      {children}
    </>
  );
}

function AlreadyThere({ file, check }: { file: string; check: AllPhotosCheck }) {
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <CircleAlertIcon className="size-4" aria-hidden />
          Already in ALLPHOTOS.json
        </CardTitle>
        <CardDescription>
          {file} with the same GPS position and creation date is already in {check.path} or waiting
          in the photo data pull request, so it can't be uploaded or saved again. Editing a saved
          photo isn't supported yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {check.matches.map((match, index) => (
          <div key={index} className="flex flex-col gap-2">
            <p className="text-sm">
              Found in{" "}
              <a
                href={match.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                {match.source}
              </a>
            </p>
            <JsonCodeBlock value={match.entry} title="Saved photo data" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Places the check couldn't fully read. */
function SourceProblems({ check }: { check: AllPhotosCheck }) {
  const problems = check.sources.filter((source) => source.error);
  if (problems.length === 0) return null;
  return (
    <Warning>
      Couldn't fully check{" "}
      {problems.map((source) => `${source.label} (${source.error})`).join(" or ")}, so make sure
      this photo isn't already saved.
    </Warning>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
