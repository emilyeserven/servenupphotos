import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type ColorFile,
  type ColorsPreview,
  type ColorsResult,
  colorsPreviewQuery,
  writeColorsMutation,
} from "@/api/data";
import { ColorData } from "@/components/color-data";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CommitSuccess,
  FileDetails,
  invalidatePhotoReads,
  OptionCheckbox,
  SaveButton,
  ScanPreviewBody,
  count,
} from "@/components/update-data-shared";

interface PhotoColorsCardProps {
  /** Whether R2 is set up, so the originals can be read. */
  canRead: boolean;
}

/** Reads each photo's colors from its original in R2 and saves them in its photo file. */
export function PhotoColorsCard({ canRead }: PhotoColorsCardProps) {
  const queryClient = useQueryClient();
  const [recompute, setRecompute] = useState(false);
  const [checked, setChecked] = useState<boolean | null>(null);
  const write = useMutation({
    ...writeColorsMutation,
    onSuccess: () => {
      setChecked(null);
      invalidatePhotoReads(queryClient);
    },
  });
  const disabled = !canRead || write.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Colors</CardTitle>
        <CardDescription>
          Reads each photo&apos;s colors from its original in R2, as the Colors and Raw color data
          tabs on the EXIF page show them, and saves them under <code>colors</code> in its photo
          file: the average color, the share of the photo in each of 12 hue buckets, the blacks,
          grays and whites, the mean lightness and chroma, and the raw statistics for each color
          space. It downloads each of those photos, so it takes a while.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <OptionCheckbox
          label="Read the colors of photos that already have them again"
          hint={recomputeHint(canRead)}
          checked={recompute}
          disabled={disabled}
          onChange={(value) => {
            setRecompute(value);
            setChecked(null);
            write.reset();
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={disabled}
          onClick={() => {
            write.reset();
            setChecked(recompute);
          }}
        >
          Check photo files
        </Button>

        {checked !== null && (
          <ColorsResultView
            recompute={checked}
            pending={write.isPending}
            error={write.error}
            onApply={() => write.mutate(checked)}
          />
        )}
        {write.isSuccess && <WriteSuccess result={write.data} />}
      </CardContent>
    </Card>
  );
}

/** The recompute option's hint, or what to set up first when R2 isn't. */
function recomputeHint(canRead: boolean): string {
  return canRead
    ? "Off, only photos without colors get them. On, every photo's colors are read again and replace the ones it has, such as after replacing its image."
    : "Set up Cloudflare R2 in Settings to read the photos' colors.";
}

interface ResultViewProps {
  recompute: boolean;
  pending: boolean;
  error: Error | null;
  onApply: () => void;
}

/** What adding the colors would do, with the button that does it. */
function ColorsResultView({ recompute, ...apply }: ResultViewProps) {
  const preview = useQuery(colorsPreviewQuery(recompute));
  return (
    <section aria-label="Preview" className="flex flex-col gap-4 border-t pt-6">
      <QueryResult query={preview} pendingLabel="Reading the photo JSON and the originals' colors…">
        {(data) => <PreviewBody preview={data} {...apply} />}
      </QueryResult>
    </section>
  );
}

type PreviewBodyProps = Omit<ResultViewProps, "recompute"> & { preview: ColorsPreview };

function PreviewBody({ preview, ...apply }: PreviewBodyProps) {
  return (
    <ScanPreviewBody
      scan={preview}
      changed={preview.files.length}
      nothing="have colors, so there's nothing to add"
      headline={headline(preview)}
    >
      <ColorFiles files={preview.files} />
      <ApplyButton preview={preview} {...apply} />
    </ScanPreviewBody>
  );
}

/** What happens to the files, such as "don't have colors yet (3 already do)". */
function headline(preview: ColorsPreview): string {
  if (preview.recompute) return "get their colors read again";
  const have = preview.haveColors > 0 ? ` (${preview.haveColors} already do)` : "";
  return `don't have colors yet${have}`;
}

/** Each file that gets colors, collapsed to its name and average color, with its colors inside. */
function ColorFiles({ files }: { files: ColorFile[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-md border text-sm">
      {files.map((file) => (
        <FileDetails
          key={file.path}
          path={file.path}
          note={fileNote(file)}
          swatch={file.colors?.average.hex}
        >
          <div className="px-3 pt-1 pb-3">
            {file.colors ? (
              <ColorData colors={file.colors} />
            ) : (
              <p className="text-destructive">
                Couldn&apos;t read its colors, so it&apos;s left as it is: {file.error}
              </p>
            )}
          </div>
        </FileDetails>
      ))}
    </ul>
  );
}

/** A file's note in the list: its average color, or that it couldn't be read. */
function fileNote(file: ColorFile): string {
  if (!file.colors) return "couldn't be read";
  return file.replaces
    ? `${file.colors.average.hex}, replaces its colors`
    : file.colors.average.hex;
}

/** The button that saves the colors, held back while a photo file can't be read. */
function ApplyButton({ preview, pending, error, onApply }: PreviewBodyProps) {
  const ready = preview.files.filter((f) => f.colors).length;
  return (
    <SaveButton
      label={`Save colors in ${count(ready, "file")}`}
      disabled={preview.unreadable.length > 0 || ready === 0}
      pending={pending}
      error={error}
      onClick={onApply}
    >
      <FailedNote failed={preview.files.length - ready} />
    </SaveButton>
  );
}

/** How many photos' colors couldn't be read, which saving leaves as they are. */
function FailedNote({ failed }: { failed: number }) {
  if (failed === 0) return null;
  return (
    <p className="text-muted-foreground text-sm">
      {count(failed, "photo")} couldn&apos;t be read, so {failed === 1 ? "it's" : "they're"} left as{" "}
      {failed === 1 ? "it is" : "they are"}.
    </p>
  );
}

function WriteSuccess({ result }: { result: ColorsResult }) {
  const failed = result.failed > 0 ? ` (${count(result.failed, "photo")} couldn't be read)` : "";
  return (
    <CommitSuccess result={result}>
      Saved colors in {count(result.files, "file")}
      {failed}
    </CommitSuccess>
  );
}
