import { ImageUpIcon } from "lucide-react";
import { type MissingImage, photoFile } from "@/components/edit-in-flight/photo-json";
import {
  busy,
  ImageField,
  NewImageCrop,
  ReadStatus,
  ReplaceError,
} from "@/components/edit-in-flight/replace-image-card";
import { type ReplaceImage, useReplaceImage } from "@/components/edit-in-flight/use-replace-image";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/**
 * The Photo page for a saved photo whose image R2 doesn't have, such as one saved before its upload
 * finished: choosing the JPEG uploads it with every size and a Square Thumbnail picked on it, then
 * saves the photo's JSON with the new links as a change waiting for Commit, after which the page
 * opens the photo's usual editor.
 */
export function MissingImageEditor({ missing }: { missing: MissingImage }) {
  // A missing image has no saved square, so the Square Thumbnail is always picked on the new one.
  const upload = useReplaceImage(missing, missing.data, null, true);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Upload the missing image</CardTitle>
          <CardDescription>
            <MissingNote missing={missing} /> Choose the JPEG to upload it to R2 with every size;
            the photo keeps its ID, title, EXIF, places, albums and tags, its JSON gets the new
            links and waits for Commit, and then it can be edited as usual.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ImageField replace={upload} disabled={false} />
          <ReadStatus replace={upload} />
          <UploadButton upload={upload} />
        </CardContent>
      </Card>
      <NewImageCrop replace={upload} />
      <Card>
        <CardHeader>
          <CardTitle>Saved JSON</CardTitle>
          <CardDescription>The file as it is now, with empty image links.</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonCodeBlock value={missing.data} title={missing.file.path} />
        </CardContent>
      </Card>
    </>
  );
}

/** Why the photo can't be edited yet, naming the file R2 was searched for. */
function MissingNote({ missing }: { missing: MissingImage }) {
  const file = photoFile(missing.data);
  if (!file) return <>R2 has no image for this photo, so it can&apos;t be edited yet.</>;
  return (
    <>
      R2 has no image for this photo (<code>{file}</code>), so it can&apos;t be edited yet.
    </>
  );
}

/** Uploads the chosen JPEG and saves the JSON, once it's read and its square is picked. */
function UploadButton({ upload }: { upload: ReplaceImage }) {
  if (!upload.read.data?.sanitized) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={!canUpload(upload)} onClick={() => upload.replace.mutate()}>
        <UploadIcon pending={upload.replace.isPending} />
        Upload image
      </Button>
      <ReplaceError replace={upload} />
    </div>
  );
}

/** Whether the chosen JPEG can be uploaded: it isn't still being read or uploaded, and has a square. */
function canUpload(upload: ReplaceImage): boolean {
  return !busy(upload) && upload.hasCrop;
}

function UploadIcon({ pending }: { pending: boolean }) {
  return pending ? <Spinner /> : <ImageUpIcon />;
}
