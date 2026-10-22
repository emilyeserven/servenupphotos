import { createFileRoute } from "@tanstack/react-router";
import {
  createColumnHelper,
  createSortedRowModel,
  FlexRender,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Table } from "lucide-react";
import { useState } from "react";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import { ViewPlaceholder } from "@/components/view-placeholder";
import {
  photos,
  SETTING_FORMATS,
  type CameraSettings,
  type Photo,
  type PhotoImage,
} from "@/lib/photos";
import { cn } from "@/lib/utils";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/** The columns that can be sorted by, as they're named in the URL. */
const SORTABLE = [
  "title",
  "takenAt",
  "location",
  "camera",
  "aperture",
  "exposure",
  "iso",
  "focalLength",
] as const;

type SortColumn = (typeof SORTABLE)[number];

interface TableSearch {
  /** Left out for the default, newest first. */
  sort?: SortColumn;
  dir?: "asc" | "desc";
}

export const Route = createFileRoute("/table")({
  validateSearch: (search: Record<string, unknown>): TableSearch => {
    const sort = SORTABLE.find((column) => column === search.sort);
    if (!sort) return {};
    return { sort, dir: search.dir === "asc" ? "asc" : "desc" };
  },
  component: TableView,
});

/** Exiftool's exposure time, such as "1/60" or "2.5", in seconds, so exposures sort by length. */
function exposureSeconds(exposure: string | null): number | undefined {
  if (!exposure) return undefined;
  const [top = Number.NaN, bottom] = exposure.split("/").map(Number);
  const seconds = bottom ? top / bottom : top;
  return Number.isFinite(seconds) ? seconds : undefined;
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
});

const helper = createColumnHelper<typeof features, Photo>();

// Missing values are undefined, rather than null, so they sort last whichever way the column goes.
const columns = helper.columns([
  helper.display({ id: "image", header: "", enableSorting: false }),
  helper.accessor("title", { header: "Title", sortFn: "text" }),
  helper.accessor("takenAt", { header: "Taken", sortFn: "datetime", sortDescFirst: true }),
  helper.accessor((photo) => photo.location?.label, {
    id: "location",
    header: "Place",
    sortFn: "text",
    sortUndefined: "last",
  }),
  helper.accessor("camera", { header: "Camera", sortFn: "text" }),
  helper.accessor((photo) => photo.settings.aperture ?? undefined, {
    id: "aperture",
    header: "Aperture",
    sortFn: "basic",
    sortUndefined: "last",
  }),
  helper.accessor((photo) => exposureSeconds(photo.settings.exposure), {
    id: "exposure",
    header: "Exposure",
    sortFn: "basic",
    sortUndefined: "last",
  }),
  helper.accessor((photo) => photo.settings.iso ?? undefined, {
    id: "iso",
    header: "ISO",
    sortFn: "basic",
    sortUndefined: "last",
  }),
  helper.accessor((photo) => photo.settings.focalLength ?? undefined, {
    id: "focalLength",
    header: "Focal length",
    sortFn: "basic",
    sortUndefined: "last",
  }),
]);

/** The columns of numbers, lined up on the right so their digits line up. */
const NUMERIC = new Set(["aperture", "exposure", "iso", "focalLength"]);

const DEFAULT_SORT = { id: "takenAt", desc: true };

/** The sort the URL asks for: newest first unless it says otherwise. */
function sortingOf(search: TableSearch): SortingState {
  return [{ id: search.sort ?? DEFAULT_SORT.id, desc: search.dir !== "asc" }];
}

/** The URL's search for a sort, leaving out the default, newest first. */
function searchOf([sort = DEFAULT_SORT]: SortingState): TableSearch {
  if (sort.id === DEFAULT_SORT.id && sort.desc) return {};
  return { sort: sort.id as SortColumn, dir: sort.desc ? "desc" : "asc" };
}

function TableView() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [shown, setShown] = useState<ImagePhoto | null>(null);
  const sorting = sortingOf(search);

  const table = useTable({
    features,
    columns,
    data: photos,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({ search: searchOf(next), replace: true });
    },
    enableSortingRemoval: false,
    enableMultiSort: false,
  });

  if (photos.length === 0) return <ViewPlaceholder to="/table" />;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Table className="size-8 text-muted-foreground" aria-hidden />
          Table
        </h1>
        <p className="text-sm text-muted-foreground">{photos.length} photos</p>
      </header>
      {/* Scrolls sideways on narrow screens rather than squeezing the columns. */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <HeaderCell key={header.id} header={header} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <PhotoRow key={row.id} photo={row.original} onOpen={setShown} />
            ))}
          </tbody>
        </table>
      </div>
      <PhotoLightbox photo={shown} onClose={() => setShown(null)} />
    </div>
  );
}

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

type PhotoHeader = Header<typeof features, Photo, unknown>;

/** A column's name, a button sorting by it when it can be sorted. */
function HeaderCell({ header }: { header: PhotoHeader }) {
  const { column } = header;
  const sorted = column.getIsSorted();
  return (
    <th
      scope="col"
      aria-sort={sorted ? ARIA_SORT[sorted] : undefined}
      className={cn(
        "px-3 py-2 font-medium whitespace-nowrap",
        NUMERIC.has(column.id) && "text-right",
      )}
    >
      {column.getCanSort() ? <SortButton header={header} /> : <FlexRender header={header} />}
    </th>
  );
}

function SortButton({ header }: { header: PhotoHeader }) {
  const sorted = header.column.getIsSorted();
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
        sorted && "text-foreground",
      )}
    >
      <FlexRender header={header} />
      <SortIcon sorted={sorted} />
    </button>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp aria-hidden />;
  if (sorted === "desc") return <ArrowDown aria-hidden />;
  return <ArrowUpDown aria-hidden className="opacity-50" />;
}

/** A dash for a value the photo doesn't have. */
const DASH = <span className="text-muted-foreground">—</span>;

/** Each setting as a photographer writes it, such as "f/5.6", or null when its EXIF didn't say. */
function settingCells(settings: CameraSettings): (string | null)[] {
  return SETTING_FORMATS.map(([key, write]) => {
    const value = settings[key];
    return value === null ? null : write(value);
  });
}

/**
 * A photo's thumbnail, title, date, place, camera and settings. The thumbnail and the title open
 * the photo in the lightbox; photos without resized versions in R2 have nothing to open.
 */
function PhotoRow({ photo, onOpen }: { photo: Photo; onOpen: (photo: ImagePhoto) => void }) {
  const { image } = photo;
  const open = image ? () => onOpen({ ...photo, image }) : undefined;
  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        <PhotoThumbnailButton image={image} title={photo.title} onOpen={open} className="size-10" />
      </td>
      <td className="max-w-56 px-3 py-2">
        <RowTitle title={photo.title} onOpen={open} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <time dateTime={photo.takenAt.toISOString()}>{format(photo.takenAt, "MMM d, yyyy")}</time>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {photo.location ? <PhotoLocation location={photo.location} /> : DASH}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{photo.camera}</td>
      {settingCells(photo.settings).map((text, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the settings are always in the same order.
        <td key={index} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
          {text ?? DASH}
        </td>
      ))}
    </tr>
  );
}

/** The photo's title, a button opening the lightbox when there's an image to show. */
function RowTitle({ title, onOpen }: { title: string; onOpen?: () => void }) {
  if (!onOpen) return <span className="block truncate font-medium">{title}</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="max-w-full cursor-zoom-in truncate text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
    >
      {title}
    </button>
  );
}
