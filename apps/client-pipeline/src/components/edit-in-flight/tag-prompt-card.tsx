import { useQuery } from "@tanstack/react-query";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { CopyPromptButton } from "@/components/edit-in-flight/copy-prompt-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExifPlace, PhotoDetails } from "@/components/photo-details";
import { knownLines } from "@/lib/location-prompt";
import { tagPrompt } from "@/lib/tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

interface TagPromptCardProps {
  /** The public URL of the photo's version the prompt links to. */
  imageUrl: string;
  /** The photo's details being edited, for what's known of where it was taken. */
  details: PhotoDetails;
  exif: ExifPlace;
}

/**
 * Copies a prompt that asks an LLM for the photo's tags, with what's known of where it was taken
 * so its cultural terms fit, as a comma-separated list to paste into the Tags field, which adds them.
 */
export function TagPromptCard({ imageUrl, details, exif }: TagPromptCardProps) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const known = knownLines({ details, exif, places: readEntries(places.data?.places) });
  const combined = useCombinedData();
  const groups = metaGroups(combined.data);
  const data = organize.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggest tags</CardTitle>
        <CardDescription>
          Copies a prompt for a chat with an LLM, with a link to the photo&apos;s Small version,
          where it was taken, and every tag to reuse. Paste the comma-separated list it answers with
          into Tags to add them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CopyPromptButton
          label="Copy tag prompt"
          disabled={!data}
          prompt={() => (data ? tagPrompt(imageUrl, { ...data, metaGroups: groups, known }) : "")}
          onCopied={() => {}}
        />
      </CardContent>
    </Card>
  );
}
