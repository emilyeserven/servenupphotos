import {
  CameraIcon,
  FileImageIcon,
  FileTextIcon,
  GlobeIcon,
  LanguagesIcon,
  LibraryIcon,
  Link2Icon,
  ListPlusIcon,
  type LucideIcon,
  PaletteIcon,
  ScissorsIcon,
  TagsIcon,
  TextCursorInputIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { r2IsSetUp, type SettingsResponse } from "@/api/settings";
import { BulkTaggingCard } from "@/components/bulk-tagging/bulk-tagging-card";
import { ImageBaseUrlCard } from "@/components/image-base-url";
import { ImageNamesCard } from "@/components/image-names-card";
import { LocalizationFillCard } from "@/components/localization-fill/localization-fill-card";
import { MissingFieldsCard } from "@/components/missing-fields";
import { PhotoColorsCard } from "@/components/photo-colors-card";
import { R2ExifCard } from "@/components/r2-exif/r2-exif-card";
import { PruneTagsCard } from "@/components/prune-tags/prune-tags-card";
import { ReapplyOverridesCard } from "@/components/reapply-overrides";
import { TagDescriptionsCard } from "@/components/tag-descriptions/tag-descriptions-card";
import { TagLibraryCard } from "@/components/tag-library/tag-library-card";
import { TimezoneShiftCard } from "@/components/timezone-shift/timezone-shift-card";

/** One of Update Data's subpages or one of the tag tools: a single bulk change, shown as its card. */
export interface UpdateDataSection {
  /** The last part of its URL, such as `image-names` in `/update-data/image-names`. */
  slug: string;
  /** Its name in the side navigation, the same as its card's title. */
  title: string;
  /** The icon left of its name in the side navigation. */
  icon: LucideIcon;
  /** Draws its card, given the saved settings. */
  render: (settings: SettingsResponse) => ReactNode;
}

/** Every Update Data subpage, in the order the side navigation lists them. */
export const updateDataSections: readonly UpdateDataSection[] = [
  {
    slug: "image-base-url",
    title: "Image base URL",
    icon: Link2Icon,
    render: (s) => <ImageBaseUrlCard publicUrl={s.r2.publicUrl} />,
  },
  {
    slug: "image-names",
    title: "Image names",
    icon: TextCursorInputIcon,
    render: () => <ImageNamesCard />,
  },
  {
    slug: "missing-fields",
    title: "Missing fields",
    icon: ListPlusIcon,
    render: (s) => <MissingFieldsCard canReadExif={r2IsSetUp(s.r2)} />,
  },
  {
    slug: "colors",
    title: "Colors",
    icon: PaletteIcon,
    render: (s) => <PhotoColorsCard canRead={r2IsSetUp(s.r2)} />,
  },
  {
    slug: "camera-overrides",
    title: "Camera overrides",
    icon: CameraIcon,
    render: () => <ReapplyOverridesCard />,
  },
  {
    slug: "localizations",
    title: "Localizations",
    icon: LanguagesIcon,
    render: () => <LocalizationFillCard />,
  },
  {
    slug: "timezones",
    title: "Times across timezones",
    icon: GlobeIcon,
    render: () => <TimezoneShiftCard />,
  },
  {
    slug: "r2-exif",
    title: "EXIF in R2",
    icon: FileImageIcon,
    render: (s) => <R2ExifCard canRead={r2IsSetUp(s.r2)} />,
  },
];

/** One of the tag tools: a bulk change to the photos' tags or the tag files, on a page of its own. */
export interface TagTool extends UpdateDataSection {
  /** The line under its page's title. */
  description: string;
}

/** Every tag tool, in the order the Tags submenu lists them under its Tools header. */
export const tagTools: readonly TagTool[] = [
  {
    slug: "bulk-tagging",
    title: "Bulk tagging",
    description: "Tags photos that have none, with an LLM's suggestions you review.",
    icon: TagsIcon,
    render: () => <BulkTaggingCard />,
  },
  {
    slug: "tag-library",
    title: "Tag library",
    description: "Reworks the whole tag library at once, with an LLM's suggestions you review.",
    icon: LibraryIcon,
    render: () => <TagLibraryCard />,
  },
  {
    slug: "tag-pruning",
    title: "Tag pruning",
    description: "Merges, removes or regroups tags with too few photos.",
    icon: ScissorsIcon,
    render: () => <PruneTagsCard />,
  },
  {
    slug: "tag-descriptions",
    title: "Tag descriptions",
    description: "Writes descriptions for the tags that have none.",
    icon: FileTextIcon,
    render: () => <TagDescriptionsCard />,
  },
];

/**
 * Where the Update Data subpages that moved out of it are now, by their old slug, so an old link or
 * bookmark still opens them.
 */
export const movedSections: Readonly<Record<string, string>> = {
  "location-names": "/location-names",
  "bulk-places": "/bulk-places",
  "genre-suggestions": "/genre-suggestions",
  "album-suggestions": "/album-suggestions",
  ...Object.fromEntries(tagTools.map((s) => [s.slug, `/tag-tools/${s.slug}`])),
};
