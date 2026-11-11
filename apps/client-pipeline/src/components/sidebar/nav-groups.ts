import {
  ActivityIcon,
  ApertureIcon,
  BookImageIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  RouteIcon,
  CameraIcon,
  DatabaseIcon,
  FolderTreeIcon,
  GalleryHorizontalIcon,
  HeartIcon,
  HistoryIcon,
  ImageIcon,
  ImagePlusIcon,
  ImagesIcon,
  LanguagesIcon,
  LayoutGridIcon,
  LightbulbIcon,
  ListChecksIcon,
  type LucideIcon,
  MapPinIcon,
  MapPinnedIcon,
  MessageSquareTextIcon,
  PlaneIcon,
  RefreshCwIcon,
  ScaleIcon,
  ScalingIcon,
  ScanTextIcon,
  SettingsIcon,
  ShapesIcon,
  SignpostIcon,
  SparklesIcon,
  TagIcon,
  TagsIcon,
} from "lucide-react";
import type { FileRoutesByTo } from "@/routeTree.gen";
import { tagTools, updateDataSections } from "@/components/update-data/sections";

/** A page in the sidebar, with the icon it has when collapsed. */
export interface NavPage {
  /** Its name in the sidebar and the breadcrumbs. */
  title: string;
  /** Where it opens; pages under this URL, such as an album's, show as this page. */
  url: keyof FileRoutesByTo;
  /** The subpage a `$section` URL opens, such as `image-names` for `/update-data/$section`. */
  section?: string;
  icon: LucideIcon;
  /** A small header shown above this page in its submenu, starting a group such as Tools under Tags. */
  heading?: string;
  /** Pages listed under it in its submenu, such as Small Tags under Tags. */
  children?: readonly NavPage[];
}

/** One of the sidebar's sections, such as Organize, and its pages. */
export interface NavGroup {
  title: string;
  items: readonly NavPage[];
}

/** Every page in the sidebar, grouped the way the sidebar shows them. */
export const navGroups: readonly NavGroup[] = [
  {
    title: "Images",
    items: [
      {
        title: "Photo",
        url: "/exif",
        icon: ImageIcon,
        children: [{ title: "Alt Text", url: "/alt-text", icon: ScanTextIcon }],
      },
      { title: "Gallery", url: "/gallery", icon: LayoutGridIcon },
      { title: "All Photos", url: "/all-photos", icon: ImagesIcon },
    ],
  },
  {
    title: "Pipeline",
    items: [
      { title: "Photos in Flight", url: "/in-flight", icon: PlaneIcon },
      { title: "Compare", url: "/compare", icon: ScaleIcon },
      { title: "Lightroom Albums", url: "/lightroom-albums", icon: FolderTreeIcon },
    ],
  },
  {
    title: "Organize",
    items: [
      {
        title: "Albums",
        url: "/albums",
        icon: BookImageIcon,
        children: [{ title: "Album Suggestions", url: "/album-suggestions", icon: LightbulbIcon }],
      },
      {
        title: "Tags",
        url: "/tags",
        icon: TagsIcon,
        children: [
          { title: "Small Tags", url: "/small-tags", icon: TagIcon },
          // The tag tools, each a page of its own, under a Tools header.
          ...tagTools.map((tool, i) => ({
            title: tool.title,
            url: "/tag-tools/$section" as const,
            section: tool.slug,
            icon: tool.icon,
            heading: i === 0 ? "Tools" : undefined,
          })),
        ],
      },
      {
        title: "Genres",
        url: "/genres",
        icon: ShapesIcon,
        children: [{ title: "Genre Suggestions", url: "/genre-suggestions", icon: LightbulbIcon }],
      },
      {
        title: "Places",
        url: "/places",
        icon: MapPinIcon,
        children: [
          { title: "Location Names", url: "/location-names", icon: SignpostIcon },
          { title: "Bulk Places", url: "/bulk-places", icon: MapPinnedIcon },
          { title: "Localizations", url: "/localizations", icon: LanguagesIcon },
        ],
      },
    ],
  },
  {
    title: "Publish",
    items: [
      {
        title: "Instagram",
        url: "/instagram",
        icon: CalendarDaysIcon,
        children: [{ title: "Planned Posts", url: "/instagram-planned", icon: ListChecksIcon }],
      },
      { title: "Captions", url: "/caption-templates", icon: MessageSquareTextIcon },
      { title: "Photo Book", url: "/photo-book", icon: BookOpenIcon },
      { title: "Site Spotlight", url: "/site-spotlight", icon: SparklesIcon },
      { title: "Related Photos", url: "/related-photos", icon: GalleryHorizontalIcon },
      { title: "User Likes", url: "/viewer-likes", icon: HeartIcon },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        title: "Settings",
        url: "/settings",
        icon: SettingsIcon,
        children: [
          { title: "Status", url: "/settings/status", icon: ActivityIcon },
          { title: "Changelog", url: "/changelog", icon: HistoryIcon },
          { title: "Explore Bucket", url: "/bucket", icon: DatabaseIcon },
          { title: "Manage Sizes", url: "/sizes", icon: ScalingIcon },
        ],
      },
      {
        title: "Update Data",
        url: "/update-data",
        icon: RefreshCwIcon,
        // Its subpages, the same list as its own side navigation.
        children: updateDataSections.map((section) => ({
          title: section.title,
          url: "/update-data/$section" as const,
          section: section.slug,
          icon: section.icon,
        })),
      },
      { title: "Metadata Groups", url: "/metadata-groups", icon: ApertureIcon },
      { title: "Camera Overrides", url: "/camera-overrides", icon: CameraIcon },
      { title: "Gear Pictures", url: "/gear-pictures", icon: ImagePlusIcon },
      { title: "Trip Lines", url: "/trip-lines", icon: RouteIcon },
      { title: "Graph Presets", url: "/graph-presets", icon: ChartColumnIcon },
    ],
  },
];

/** The path a sidebar page opens, with its `$section` filled in. */
export function pagePath(page: NavPage): string {
  return page.section ? page.url.replace("$section", page.section) : page.url;
}

/** Whether the open page is this sidebar page or one under it, such as an Update Data subpage. */
export function isUnder(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/** Whether the open page is this sidebar page, one under it, or one in its submenu. */
export function isWithin(pathname: string, page: NavPage): boolean {
  return (
    isUnder(pathname, pagePath(page)) || (page.children ?? []).some((c) => isWithin(pathname, c))
  );
}

/** Where the open page is in the sidebar: its section, and the page with the one in its submenu after it. */
export interface NavTrail {
  group: string;
  /** The sidebar page, and the page in its submenu when the open page is one. */
  pages: NavPage[];
}

/** Where the open page is in the sidebar, for the breadcrumbs; nothing for a page the sidebar doesn't list. */
export function navTrail(pathname: string): NavTrail | undefined {
  for (const group of navGroups) {
    const pages = pageTrail(pathname, group.items);
    if (pages) return { group: group.title, pages };
  }
  return undefined;
}

function pageTrail(pathname: string, pages: readonly NavPage[]): NavPage[] | undefined {
  const page = pages.find((p) => isWithin(pathname, p));
  if (!page) return undefined;
  return [page, ...(pageTrail(pathname, page.children ?? []) ?? [])];
}
