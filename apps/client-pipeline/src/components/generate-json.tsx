import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { BracesIcon } from "lucide-react";
import { useState } from "react";
import type { ExifResponse, SanitizedExif } from "@/api/exif";
import {
  type BucketImage,
  allPhotosOnBaseQuery,
  bucketExifMutation,
  photosInFlightQuery,
} from "@/api/photos";
import { PUBLISHED, parseVersionKey } from "@/api/versions";
import { AllPhotosGate } from "@/components/allphotos-check";
import { GitHubSaveCard } from "@/components/github-save";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface GenerateJsonProps {
  /** The original JPEG in R2. */
  original: BucketImage;
  /** The resized copies uploaded with it, whose URLs go into the JSON. */
  copies: BucketImage[];
}

/**
 * A button that reads a photo's EXIF and colors from its original in R2, as Add Photo does for an
 * upload, and offers its JSON to Save to GitHub under a file name the user picks.
 */
export function GenerateJsonButton({ original, copies }: GenerateJsonProps) {
  const queryClient = useQueryClient();
  const extract = useMutation(bucketExifMutation);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // The original is read once, the first time the modal opens.
  const start = () => {
    if (extract.isIdle) extract.mutate(original.key);
  };
  // The tile turns in flight once the saved photo is in the pull request, which removes this
  // button, so the bucket's marks are refreshed only after the modal closes.
  const refreshMarks = () => {
    if (!saved) return;
    void queryClient.invalidateQueries({ queryKey: photosInFlightQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: allPhotosOnBaseQuery.queryKey });
  };
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) start();
    else refreshMarks();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="self-start">
          <BracesIcon />
          Generate JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate JSON</DialogTitle>
          <DialogDescription className="font-mono break-all">{original.key}</DialogDescription>
        </DialogHeader>
        <GeneratedJson
          extract={extract}
          original={original}
          copies={copies}
          onSaved={() => setSaved(true)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface GeneratedJsonProps extends GenerateJsonProps {
  extract: UseMutationResult<ExifResponse, Error, string>;
  onSaved: () => void;
}

function GeneratedJson({ extract, original, copies, onSaved }: GeneratedJsonProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <img
        src={original.url}
        alt={original.key}
        className="bg-muted max-h-60 w-full rounded-lg border object-contain"
      />
      <ExtractResult extract={extract} original={original} copies={copies} onSaved={onSaved} />
    </div>
  );
}

/** Reading the original, why it couldn't be read, or its JSON. */
function ExtractResult({ extract, original, copies, onSaved }: GeneratedJsonProps) {
  if (extract.isError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{extract.error.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => extract.mutate(original.key)}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (!extract.isSuccess) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner />
        Reading the original from R2…
      </p>
    );
  }
  if (!extract.data.sanitized) {
    return (
      <p className="text-muted-foreground text-sm">
        EXIF data is unavailable because exiftool is not running on the backend.
      </p>
    );
  }
  return (
    <PhotoJson
      file={extract.data.file}
      sanitized={withBucketImages(extract.data.sanitized, original, copies)}
      onSaved={onSaved}
    />
  );
}

interface PhotoJsonProps {
  file: string;
  sanitized: SanitizedExif;
  onSaved: () => void;
}

/** The JSON to save, then a check that it isn't in ALLPHOTOS.json already, then Save to GitHub. */
function PhotoJson({ file, sanitized, onSaved }: PhotoJsonProps) {
  const identity = { file, gpsPosition: sanitized.gpsPosition, createDate: sanitized.createDate };
  return (
    <>
      <JsonCodeBlock
        value={{ file, ...sanitized }}
        title="JSON to Upload"
        contentClassName="max-h-80"
      />
      <AllPhotosGate photo={identity}>
        <GitHubSaveCard file={file} sanitized={sanitized} onSaved={onSaved} />
      </AllPhotosGate>
    </>
  );
}

/** The sanitized EXIF with the original's R2 URL and key, and the URLs of the copies and thumbnail in the bucket. */
function withBucketImages(
  sanitized: SanitizedExif,
  original: BucketImage,
  copies: BucketImage[],
): SanitizedExif {
  const images = { ...sanitized.images, full: original.url, key: original.key };
  for (const version of PUBLISHED) {
    const copy = copies.find((image) => parseVersionKey(image.key)?.version.name === version.name);
    images[version.name] = copy?.url ?? null;
  }
  return { ...sanitized, images };
}
