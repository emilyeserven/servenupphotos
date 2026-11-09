import { type ReactNode } from "react";
import { type CombinedFile, type InFlightResponse } from "@/api/photos";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Skeleton } from "@/components/ui/skeleton";

/** ALLPHOTOS.json from the pull request's branch, or why it can't be shown. */
export function AllPhotosPanel({ data }: { data?: InFlightResponse }) {
  if (!data?.pullRequest) {
    return (
      <>
        <AllPhotosHeading />
        {data ? (
          <PanelNote>No pull request to read it from.</PanelNote>
        ) : (
          <Skeleton aria-label="Waiting for the pull request" className="h-96 rounded-xl" />
        )}
      </>
    );
  }
  return <AllPhotosFile all={data.allPhotos} />;
}

/** Why ALLPHOTOS.json can't be shown, or undefined when it can. */
function allPhotosProblem(all: CombinedFile): string | undefined {
  if (!all.found) return "Not on the branch yet. Commit adds it.";
  if (all.error) return all.error;
  return all.data ? undefined : "Couldn't read the file.";
}

function AllPhotosFile({ all }: { all: CombinedFile }) {
  const problem = allPhotosProblem(all);
  return (
    <>
      <AllPhotosHeading all={problem ? undefined : all} />
      {problem || !all.data ? (
        <PanelNote>{problem}</PanelNote>
      ) : (
        <JsonCodeBlock
          value={all.data}
          title={all.path}
          contentClassName="max-h-[calc(100svh-8rem)]"
        />
      )}
    </>
  );
}

/** The panel's title, linked to the file on GitHub and with its count once it's read. */
function AllPhotosHeading({ all }: { all?: CombinedFile }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
      <a
        href={all?.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-4 [&[href]]:hover:underline"
      >
        ALLPHOTOS.json
      </a>
      {all && <span className="text-muted-foreground font-normal">{all.count} listed</span>}
    </h2>
  );
}

function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">{children}</p>
  );
}
