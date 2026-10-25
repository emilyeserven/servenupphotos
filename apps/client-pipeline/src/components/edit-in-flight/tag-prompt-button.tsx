import { useQuery } from "@tanstack/react-query";
import { metaGroups } from "@/api/metainfo";
import { organizeQuery } from "@/api/organize";
import { placesQuery, readEntries } from "@/api/places";
import { PromptCopyButton } from "@/components/edit-in-flight/prompt-copy-button";
import type { ExifPlace, PhotoDetails } from "@/components/photo-details";
import { knownLines } from "@/lib/location-prompt";
import { tagPrompt } from "@/lib/tag-prompt";
import { useCombinedData } from "@/stores/combined-data";

interface TagPromptButtonProps {
  /** The public URL of the photo's version the prompt links to. */
  imageUrl: string;
  /** The photo's details being edited, for what's known of where it was taken. */
  details: PhotoDetails;
  exif: ExifPlace;
}

/**
 * The Tags field's sparkle button: copies a prompt that asks an LLM for the photo's tags, with
 * what's known of where it was taken so its cultural terms fit, and every tag to reuse. Its answer
 * pastes into the Tags field, which adds them.
 */
export function TagPromptButton({ imageUrl, details, exif }: TagPromptButtonProps) {
  const organize = useQuery(organizeQuery);
  const places = useQuery(placesQuery);
  const known = knownLines({ details, exif, places: readEntries(places.data?.places) });
  const combined = useCombinedData();
  const groups = metaGroups(combined.data);
  const data = organize.data;
  return (
    <PromptCopyButton
      label="Copy a tag prompt for an LLM"
      disabled={!data}
      prompt={() => (data ? tagPrompt(imageUrl, { ...data, metaGroups: groups, known }) : "")}
    />
  );
}
