import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type VersionName, VERSIONS, versionPreviewQuery } from "@/api/versions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useObjectUrl } from "@/hooks/use-object-url";

/** Buttons that show each resized WEBP version of photo at full size, before it is uploaded. */
export function VersionPreviews({ photo }: { photo: File }) {
  const [shown, setShown] = useState<VersionName | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resized versions</CardTitle>
        <CardDescription>
          Uploading also puts these WEBP versions in R2. Open one to check its quality at full size.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Resized versions">
          {VERSIONS.map((version) => (
            <Button
              key={version.name}
              variant={shown === version.name ? "default" : "outline"}
              aria-pressed={shown === version.name}
              onClick={() => setShown(shown === version.name ? null : version.name)}
            >
              {version.label} ({version.maxEdge}px)
            </Button>
          ))}
        </div>
        {shown && <VersionPreview photo={photo} version={shown} />}
      </CardContent>
    </Card>
  );
}

function VersionPreview({ photo, version }: { photo: File; version: VersionName }) {
  const query = useQuery(versionPreviewQuery(photo, version));
  if (query.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner /> Making the {version} version…
      </p>
    );
  }
  if (query.isError) return <p className="text-destructive text-sm">{query.error.message}</p>;
  return <FullSizeImage blob={query.data} version={version} />;
}

const sizeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

/** The version at its real pixel size, scrolling when it's wider than the page, with its dimensions and file size. */
function FullSizeImage({ blob, version }: { blob: Blob; version: VersionName }) {
  const [url, setBlob] = useObjectUrl();
  useEffect(() => setBlob(blob), [blob, setBlob]);
  const [dimensions, setDimensions] = useState<string | null>(null);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted-foreground text-sm">
        {dimensions && <>{dimensions} · </>}
        {sizeFormat.format(blob.size / 1024)} KB WEBP
      </figcaption>
      <div className="bg-muted/40 max-h-[80vh] overflow-auto rounded-lg border">
        {url && (
          <img
            src={url}
            alt={`The ${version} version at full size`}
            className="block max-w-none"
            onLoad={(e) =>
              setDimensions(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}px`)
            }
          />
        )}
      </div>
    </figure>
  );
}
