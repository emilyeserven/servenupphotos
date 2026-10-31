import type { ReactNode } from "react";
import { r2IsSetUp, type SettingsResponse } from "@/api/settings";
import { AlbumSuggestionsCard } from "@/components/album-suggestions/album-suggestions-card";
import { BulkPlacesCard } from "@/components/bulk-places/bulk-places-card";
import { BulkTaggingCard } from "@/components/bulk-tagging/bulk-tagging-card";
import { GenreSuggestionsCard } from "@/components/genre-suggestions/genre-suggestions-card";
import { ImageBaseUrlCard } from "@/components/image-base-url";
import { ImageNamesCard } from "@/components/image-names-card";
import { LocalizationFillCard } from "@/components/localization-fill/localization-fill-card";
import { LocationNamesCard } from "@/components/location-names-card";
import { MissingFieldsCard } from "@/components/missing-fields";
import { PhotoColorsCard } from "@/components/photo-colors-card";
import { PruneTagsCard } from "@/components/prune-tags/prune-tags-card";
import { ReapplyOverridesCard } from "@/components/reapply-overrides";
import { TagDescriptionsCard } from "@/components/tag-descriptions/tag-descriptions-card";

/** One of Update Data's subpages: a single bulk change, shown as its card. */
export interface UpdateDataSection {
  /** The last part of its URL, such as `image-names` in `/update-data/image-names`. */
  slug: string;
  /** Its name in the side navigation, the same as its card's title. */
  title: string;
  /** Draws its card, given the saved settings. */
  render: (settings: SettingsResponse) => ReactNode;
}

/** Every Update Data subpage, in the order the side navigation lists them. */
export const updateDataSections: readonly UpdateDataSection[] = [
  {
    slug: "image-base-url",
    title: "Image base URL",
    render: (s) => <ImageBaseUrlCard publicUrl={s.r2.publicUrl} />,
  },
  { slug: "image-names", title: "Image names", render: () => <ImageNamesCard /> },
  {
    slug: "missing-fields",
    title: "Missing fields",
    render: (s) => <MissingFieldsCard canReadExif={r2IsSetUp(s.r2)} />,
  },
  { slug: "colors", title: "Colors", render: (s) => <PhotoColorsCard canRead={r2IsSetUp(s.r2)} /> },
  { slug: "camera-overrides", title: "Camera overrides", render: () => <ReapplyOverridesCard /> },
  { slug: "location-names", title: "Location names", render: () => <LocationNamesCard /> },
  { slug: "bulk-tagging", title: "Bulk tagging", render: () => <BulkTaggingCard /> },
  { slug: "bulk-places", title: "Bulk places", render: () => <BulkPlacesCard /> },
  { slug: "tag-pruning", title: "Tag pruning", render: () => <PruneTagsCard /> },
  { slug: "tag-descriptions", title: "Tag descriptions", render: () => <TagDescriptionsCard /> },
  { slug: "localizations", title: "Localizations", render: () => <LocalizationFillCard /> },
  { slug: "genre-suggestions", title: "Genre suggestions", render: () => <GenreSuggestionsCard /> },
  { slug: "album-suggestions", title: "Album suggestions", render: () => <AlbumSuggestionsCard /> },
];
