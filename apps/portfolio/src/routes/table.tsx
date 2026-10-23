import { createFileRoute } from "@tanstack/react-router";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  FlexRender,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type Column,
  type ColumnVisibilityState,
  type Header,
  type SortingState,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Table } from "lucide-react";
import type { ReactNode } from "react";
import { NoMatchingPhotos } from "@/components/photo-filters";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { PhotoLocation } from "@/components/photo-location";
import { PhotoThumbnailButton } from "@/components/photo-thumbnail";
import { TableViewMenu } from "@/components/table-view-menu";
import { CameraFilterBar } from "@/components/camera-filters";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ViewPlaceholder } from "@/components/view-placeholder";
import {
  photos,
  settingText,
  type SettingKey,
  type CameraSettings,
  type Photo,
  type PhotoImage,
} from "@/lib/photos";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import {
  DEFAULT_LOCATION_DETAIL,
  LOCATION_DETAILS,
  type LocationDetail,
  locationText,
  parseLocationDetail,
} from "@/lib/location-detail";
import { parseShownPhoto, type ShownPhotoSearch, useShownPhoto } from "@/lib/shown-photo";
import {
  exposureSeconds,
  filterWithCamera,
  parseCameraFilters,
  type CameraFilters,
} from "@/lib/camera-filters";
import { cn } from "@/lib/utils";

/** A photo with resized versions in R2, which is all the lightbox can show. */
type ImagePhoto = Photo & { image: PhotoImage };

/** The columns that can be sorted by, as they're named in the URL. */
const SORTABLE = [
  "title",
  "takenAt",
  "location",
  "camera",
  "lens",
  "aperture",
  "exposure",
  "iso",
  "focalLength",
] as const;

type SortColumn = (typeof SORTABLE)[number];

/** Every column but the title can be hidden; the title is what names each row. */
const HIDEABLE = ["image", ...SORTABLE.filter((column) => column !== "title")] as const;

type HideableColumn = (typeof HIDEABLE)[number];

/** Each column's name, in its header and in the Columns menu. */
const LABELS: Record<SortColumn | HideableColumn, string> = {
  image: "Thumbnail",
  title: "Title",
  takenAt: "Taken",
  location: "Place",
  camera: "Camera",
  lens: "Lens",
  aperture: "Aperture",
  exposure: "Exposure",
  iso: "ISO",
  focalLength: "Focal length",
};

interface TableSearch {
  /** Left out for the default, newest first. */
  sort?: SortColumn;
  dir?: "asc" | "desc";
  /** The columns hidden from the Columns menu; left out when every column is shown. */
  hide?: HideableColumn[];
  /** How much of each photo's location the Place column shows; left out for the most specific place. */
  placeDetail?: LocationDetail;
}

/** How much of each location the URL asks the Place column to show, leaving out the default. */
function parsePlaceDetail(search: Record<string, unknown>): TableSearch {
  const placeDetail = parseLocationDetail(search.placeDetail);
  return placeDetail ? { placeDetail } : {};
}

/** The sort the URL asks for, leaving it out when it names no column. */
function parseSort(search: Record<string, unknown>): TableSearch {
  const sort = SORTABLE.find((column) => column === search.sort);
  if (!sort) return {};
  return { sort, dir: search.dir === "asc" ? "asc" : "desc" };
}

/** The hidden columns the URL names, leaving out any it doesn't know. */
function parseHide(search: Record<string, unknown>): TableSearch {
  const named: unknown[] = Array.isArray(search.hide) ? search.hide : [];
  const hide = HIDEABLE.filter((column) => named.includes(column));
  return hide.length > 0 ? { hide } : {};
}

export const Route = createFileRoute("/table")({
  validateSearch: (
    search: Record<string, unknown>,
  ): TableSearch & PhotoFilters & CameraFilters & ShownPhotoSearch => ({
    ...parseSort(search),
    ...parseHide(search),
    ...parsePlaceDetail(search),
    ...parseFilters(search),
    ...parseCameraFilters(search),
    ...parseShownPhoto(search),
  }),
  component: TableView,
});

const features = tableFeatures({
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
});

const helper = createColumnHelper<typeof features, Photo>();

/**
 * The table's columns, with the Place column showing as much of each location as `detail` says.
 * Missing values are undefined, rather than null, so they sort last whichever way the column goes.
 */
const columnsFor = (detail: LocationDetail) =>
  helper.columns([
    helper.display({ id: "image", header: "", enableSorting: false }),
    helper.accessor("title", { header: LABELS.title, sortFn: "text", enableHiding: false }),
    helper.accessor("takenAt", { header: LABELS.takenAt, sortFn: "datetime", sortDescFirst: true }),
    // Sorted by the English names, whichever way the menu shows them.
    helper.accessor(
      (photo) => (photo.location ? locationText(photo.location.english, detail) : undefined),
      {
        id: "location",
        header: LABELS.location,
        sortFn: "text",
        sortUndefined: "last",
      },
    ),
    helper.accessor("camera", { header: LABELS.camera, sortFn: "text" }),
    helper.accessor((photo) => photo.lens ?? undefined, {
      id: "lens",
      header: LABELS.lens,
      sortFn: "text",
      sortUndefined: "last",
    }),
    helper.accessor((photo) => photo.settings.aperture ?? undefined, {
      id: "aperture",
      header: LABELS.aperture,
      sortFn: "basic",
      sortUndefined: "last",
    }),
    helper.accessor((photo) => exposureSeconds(photo.settings.exposure), {
      id: "exposure",
      header: LABELS.exposure,
      sortFn: "basic",
      sortUndefined: "last",
    }),
    helper.accessor((photo) => photo.settings.iso ?? undefined, {
      id: "iso",
      header: LABELS.iso,
      sortFn: "basic",
      sortUndefined: "last",
    }),
    helper.accessor((photo) => photo.settings.focalLength ?? undefined, {
      id: "focalLength",
      header: LABELS.focalLength,
      sortFn: "basic",
      sortUndefined: "last",
    }),
  ]);

/** The columns for each choice of the View menu, made once. */
const COLUMNS = Object.fromEntries(
  LOCATION_DETAILS.map((detail) => [detail, columnsFor(detail)]),
) as Record<LocationDetail, ReturnType<typeof columnsFor>>;

/** The columns of numbers, lined up on the right so their digits line up. */
const NUMERIC = new Set(["aperture", "exposure", "iso", "focalLength"]);

const DEFAULT_SORT = { id: "takenAt", desc: true };

/** The sort the URL asks for: newest first unless it says otherwise. */
function sortingOf(search: TableSearch): SortingState {
  return [{ id: search.sort ?? DEFAULT_SORT.id, desc: search.dir !== "asc" }];
}

/** The URL's search for a sort, leaving out the default, newest first. */
function sortSearchOf([sort = DEFAULT_SORT]: SortingState): TableSearch {
  if (sort.id === DEFAULT_SORT.id && sort.desc) return { sort: undefined, dir: undefined };
  return { sort: sort.id as SortColumn, dir: sort.desc ? "desc" : "asc" };
}

/** Which columns the URL hides, as the table keeps it. */
function visibilityOf(search: TableSearch): ColumnVisibilityState {
  return Object.fromEntries((search.hide ?? []).map((column) => [column, false]));
}

/** The URL's search for which columns are hidden, leaving it out when none are. */
function hideSearchOf(visibility: ColumnVisibilityState): TableSearch {
  const hide = HIDEABLE.filter((column) => visibility[column] === false);
  return { hide: hide.length > 0 ? hide : undefined };
}

function TableView() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { shown, show, close } = useShownPhoto();
  const sorting = sortingOf(search);
  const columnVisibility = visibilityOf(search);
  const placeDetail = search.placeDetail ?? DEFAULT_LOCATION_DETAIL;
  const filtered = filterWithCamera(photos, search);

  const table = useTable({
    features,
    columns: COLUMNS[placeDetail],
    data: filtered,
    state: { sorting, columnVisibility },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      navigate({ search: (prev) => ({ ...prev, ...sortSearchOf(next) }), replace: true });
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      navigate({ search: (prev) => ({ ...prev, ...hideSearchOf(next) }), replace: true });
    },
    enableSortingRemoval: false,
    enableMultiSort: false,
  });

  if (photos.length === 0) return <ViewPlaceholder to="/table" />;
  const visibleIds = table.getVisibleLeafColumns().map((column) => column.id as ColumnId);
  const rows = table.getRowModel().rows;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Table className="size-8 text-muted-foreground" aria-hidden />
          Table
        </h1>
        <p className="text-sm text-muted-foreground">{rows.length} photos</p>
        <TableViewMenu
          placeDetail={placeDetail}
          onPlaceDetailChange={(detail) =>
            navigate({
              search: (prev) => ({ ...prev, placeDetail: parseLocationDetail(detail) }),
              replace: true,
            })
          }
        />
        <ColumnsMenu allColumns={table.getAllLeafColumns()} />
        <div className="mt-3 w-full">
          <CameraFilterBar photos={photos} />
        </div>
      </header>
      <NoMatchingPhotos count={rows.length} />
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
            {rows.map((row) => (
              <PhotoRow
                key={row.id}
                photo={row.original}
                columnIds={visibleIds}
                placeDetail={placeDetail}
                onOpen={show}
              />
            ))}
          </tbody>
        </table>
      </div>
      <PhotoLightbox
        photo={shown}
        photos={rows.map((row) => row.original)}
        onShow={show}
        onClose={close}
      />
    </div>
  );
}

type PhotoColumn = Column<typeof features, Photo, unknown>;

/** A checkbox for each column that can be hidden, in the order they're shown. */
function ColumnsMenu({ allColumns }: { allColumns: PhotoColumn[] }) {
  const hideable = allColumns.filter((column) => column.getCanHide());
  const hidden = hideable.filter((column) => !column.getIsVisible()).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="self-center">
          <Columns3 aria-hidden />
          Columns
          {hidden > 0 && <span className="text-muted-foreground">({hidden} hidden)</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-48 flex-col gap-1 p-2">
        {hideable.map((column) => (
          <label
            key={column.id}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none hover:bg-accent"
          >
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
              className="size-4 cursor-pointer accent-primary"
            />
            {LABELS[column.id as HideableColumn]}
          </label>
        ))}
      </PopoverContent>
    </Popover>
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

type ColumnId = SortColumn | HideableColumn;

/** One setting as a photographer writes it, such as "f/5.6", or a dash when its EXIF didn't say. */
function settingCell(settings: CameraSettings, key: SettingKey): ReactNode {
  return settingText(settings, key) ?? DASH;
}

const CELL = "px-3 py-2 whitespace-nowrap";
const NUMERIC_CELL = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

/** How each column's cell looks, given the photo and how to open it in the lightbox, if it can be. */
const CELLS: Record<
  ColumnId,
  {
    className: string;
    render: (photo: Photo, open: (() => void) | undefined, detail: LocationDetail) => ReactNode;
  }
> = {
  image: {
    className: "px-3 py-2",
    render: (photo, open) => (
      <PhotoThumbnailButton
        image={photo.image}
        title={photo.title}
        onOpen={open}
        className="size-10"
      />
    ),
  },
  title: {
    className: "max-w-56 px-3 py-2",
    render: (photo, open) => <RowTitle title={photo.title} onOpen={open} />,
  },
  takenAt: {
    className: CELL,
    render: (photo) => (
      <time dateTime={photo.takenAt.toISOString()}>{format(photo.takenAt, "MMM d, yyyy")}</time>
    ),
  },
  location: {
    className: CELL,
    render: (photo, _open, detail) =>
      photo.location ? <PhotoLocation location={photo.location} detail={detail} /> : DASH,
  },
  camera: { className: CELL, render: (photo) => photo.camera },
  lens: { className: CELL, render: (photo) => photo.lens ?? DASH },
  aperture: { className: NUMERIC_CELL, render: (photo) => settingCell(photo.settings, "aperture") },
  exposure: { className: NUMERIC_CELL, render: (photo) => settingCell(photo.settings, "exposure") },
  iso: { className: NUMERIC_CELL, render: (photo) => settingCell(photo.settings, "iso") },
  focalLength: {
    className: NUMERIC_CELL,
    render: (photo) => settingCell(photo.settings, "focalLength"),
  },
};

/**
 * A photo's cells for the columns shown. The thumbnail and the title open the photo in the
 * lightbox; photos without resized versions in R2 have nothing to open.
 */
function PhotoRow({
  photo,
  columnIds,
  placeDetail,
  onOpen,
}: {
  photo: Photo;
  columnIds: ColumnId[];
  placeDetail: LocationDetail;
  onOpen: (photo: ImagePhoto) => void;
}) {
  const { image } = photo;
  const open = image ? () => onOpen({ ...photo, image }) : undefined;
  return (
    <tr className="border-t">
      {columnIds.map((id) => (
        <td key={id} className={CELLS[id].className}>
          {CELLS[id].render(photo, open, placeDetail)}
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
