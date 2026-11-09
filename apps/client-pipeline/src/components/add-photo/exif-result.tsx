import type { ExifResponse, SanitizedExif } from "@/api/exif";
import type { PhotoGroups } from "@/api/organize";
import type { ExifMutation } from "@/components/add-photo/photo-state";
import { ColorData, RawColorData } from "@/components/color-data";
import { JsonCodeBlock } from "@/components/json-code-block";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ExifResultProps {
  mutation: ExifMutation;
  /** The sanitized EXIF to show, which includes the R2 URL after an upload. */
  sanitized: SanitizedExif | null;
  /** The albums and tags to save the photo in. */
  groups: PhotoGroups;
}

/** The Results card: the JSON to upload, the EXIF and the colors of the analyzed photo, in tabs. */
export function ExifResult({ mutation, sanitized, groups }: ExifResultProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <CardDescription>{mutation.variables?.name}</CardDescription>
      </CardHeader>
      <CardContent>
        <ExifResultBody mutation={mutation} sanitized={sanitized} groups={groups} />
      </CardContent>
    </Card>
  );
}

function ExifResultBody({ mutation, sanitized, groups }: ExifResultProps) {
  if (mutation.isPending) return <Spinner className="size-6" />;
  if (mutation.isError) return <p className="text-destructive">{mutation.error.message}</p>;
  if (!mutation.data) return null;
  const { file, exif, colors } = mutation.data;
  return (
    <Tabs defaultValue="sanitized">
      <TabsList>
        <TabsTrigger value="sanitized">JSON to Upload</TabsTrigger>
        <TabsTrigger value="exif">EXIF</TabsTrigger>
        <TabsTrigger value="colors">Colors</TabsTrigger>
        <TabsTrigger value="raw">Raw color data</TabsTrigger>
      </TabsList>
      <TabsContent value="sanitized">
        <UploadJson file={file} sanitized={sanitized} groups={groups} />
      </TabsContent>
      <TabsContent value="exif">
        <ExifData exif={exif} />
      </TabsContent>
      <TabsContent value="colors">
        <ColorData colors={colors} />
      </TabsContent>
      <TabsContent value="raw">
        <RawColorData raw={colors.raw} samples={colors.samples} />
      </TabsContent>
    </Tabs>
  );
}

/** The JSON Save writes: the photo's file name and its sanitized EXIF, with the images' URLs and key after an upload, then its albums, tags and genres. */
function UploadJson({
  file,
  sanitized,
  groups,
}: {
  file: string;
  sanitized: SanitizedExif | null;
  groups: PhotoGroups;
}) {
  if (!sanitized) return <ExifData exif={null} />;
  // The title and comment first, and the albums, tags and genres last, as Save writes them.
  const { title, comment, ...rest } = sanitized;
  return (
    <JsonCodeBlock value={{ title, comment, file, ...rest, ...groups }} title="JSON to Upload" />
  );
}

function ExifData({ exif }: { exif: ExifResponse["exif"] | ExifResponse["sanitized"] }) {
  if (!exif) {
    return (
      <p className="text-muted-foreground text-sm">
        EXIF data is unavailable because exiftool is not running on the backend.
      </p>
    );
  }
  return <JsonCodeBlock value={exif} />;
}
