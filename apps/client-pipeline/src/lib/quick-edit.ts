import { placeSlug } from "@portfolio/lib/place-slug";
import type { RegionNode } from "@/lib/region-tree";

/** Where Quick Edit goes for a portfolio link: the pipeline page that edits what it shows. */
export interface QuickEditTarget {
  /** The pipeline page's address with its search, such as `/exif?photo=512`. */
  href: string;
  /** What it opens, in words, such as "Photo 512" or "Album japan-2026". */
  label: string;
}

/** Why Quick Edit can't open a link, in words for the dialog. */
export interface QuickEditError {
  error: string;
}

/** The kinds of place a map page or a location filter names, as the Places page's `edit` keeps them. */
const PLACE_KINDS = ["place", "city", "state", "country"] as const;

type PlaceKind = (typeof PLACE_KINDS)[number];

/** The portfolio's pages about one thing that a pipeline page edits as a whole, by their path. */
const PAGES: Record<string, QuickEditTarget> = {
  "/": { href: "/site-spotlight", label: "Site Spotlight (the homepage's photos)" },
  "/albums": { href: "/albums", label: "Albums" },
  "/spotlight": { href: "/albums", label: "Albums" },
  "/tags": { href: "/tags", label: "Tags" },
  "/bio": { href: "/bio", label: "Bio" },
  "/likes": { href: "/viewer-likes", label: "User Likes" },
  "/graph": { href: "/graph-presets", label: "Graph Presets" },
  "/maps/all": { href: "/places", label: "Places" },
};

/** What the dialog says for a link it can't match. */
const NO_MATCH =
  "That page doesn't show one thing to edit. Paste a link to a photo, album, Trip, tag, genre or place, or a view with one of them open or filtered on.";

/**
 * Reads a URL value the way TanStack Router writes it: JSON when it parses (so `"12"` is the text
 * 12), else the text itself; a list gives its first value.
 */
function searchValue(raw: string | null): string | undefined {
  if (raw === null || raw === "") return undefined;
  let value: unknown = raw;
  try {
    value = JSON.parse(raw);
  } catch {
    // Plain text, as most values are.
  }
  if (Array.isArray(value)) value = value[0];
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** The portfolio's own address, which a path on its own is read against. */
const PORTFOLIO_ORIGIN = "https://servenupphotos.net";

/** Whether a link's host is the portfolio's, or a copy of it running on this computer. */
function isPortfolioHost(host: string): boolean {
  return /^(www\.)?servenupphotos\.net$/.test(host) || /^(localhost|127\.0\.0\.1)$/.test(host);
}

/**
 * The pasted text as a URL: a full link, one without its `https://`, or a path on its own such as
 * `/albums/japan`.
 */
function parseLink(text: string): URL | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const withScheme =
    trimmed.startsWith("/") || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
  try {
    return new URL(withScheme, PORTFOLIO_ORIGIN);
  } catch {
    return undefined;
  }
}

/** The photo editor for a photo by its ID. */
function photoTarget(id: string): QuickEditTarget | undefined {
  const number = Number.parseInt(id, 10);
  if (!Number.isInteger(number) || number <= 0) return undefined;
  return { href: `/exif?photo=${number}`, label: `Photo ${number}` };
}

/** A Trip's page in Trip Lines, or a day's for a day in no Trip (`day-2026-10-01`). */
function tripTarget(id: string): QuickEditTarget {
  const day = /^day-(\d{4}-\d{2}-\d{2})$/.exec(id)?.[1];
  if (day) return { href: `/trip-lines/${day}`, label: `Trip Lines for ${day}` };
  return { href: `/trip-lines/trips/${encodeURIComponent(id)}`, label: `Trip ${id}` };
}

/** An album's, tag's or genre's page by its ID. */
function groupTarget(kind: "album" | "tag" | "genre", id: string): QuickEditTarget {
  const word = { album: "Album", tag: "Tag", genre: "Genre" }[kind];
  return { href: `/${kind}s/${encodeURIComponent(id)}`, label: `${word} ${id}` };
}

/** The Places page with a place (by ID) or a country, state or city (by its name's slug) open. */
function placeTarget(kind: PlaceKind, slug: string): QuickEditTarget {
  const edit = `${kind}/${slug}`;
  return {
    href: `/places?edit=${encodeURIComponent(JSON.stringify(edit))}`,
    label: `Places: ${kind} ${slug}`,
  };
}

/** Whether the text is one of the kinds of place a map page is for. */
function isPlaceKind(kind: string | undefined): kind is PlaceKind {
  return (PLACE_KINDS as readonly (string | undefined)[]).includes(kind);
}

/** The target for a path under `/albums/`: a Trip's page (`trips/<id>`) or an album's. */
function albumPathTarget([id, tripId]: string[]): QuickEditTarget | undefined {
  if (id === "trips") return tripId ? tripTarget(tripId) : undefined;
  return id ? groupTarget("album", id) : undefined;
}

/** The target for a path under `/maps/`: a place's page, such as `city/seoul`. */
function mapPathTarget([kind, slug]: string[]): QuickEditTarget | undefined {
  return slug && isPlaceKind(kind) ? placeTarget(kind, slug) : undefined;
}

/** The target for the portfolio's pages about one thing: a photo's, a Trip's, an album's or a map place's. */
function pathTarget(path: string): QuickEditTarget | undefined {
  const [first, ...rest] = pathParts(path);
  if (first === "photos") return rest[0] ? photoTarget(rest[0]) : undefined;
  if (first === "albums") return albumPathTarget(rest);
  if (first === "maps") return mapPathTarget(rest);
  return undefined;
}

/** The path's parts, decoded, leaving out empty ones such as the trailing slash's. */
function pathParts(path: string): string[] {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

/**
 * The target for a view's search: the album, tag or genre it's filtered on, or else the most exact
 * place.
 */
function searchTarget(search: URLSearchParams): QuickEditTarget | undefined {
  for (const kind of ["album", "tag", "genre"] as const) {
    const id = searchValue(search.get(kind));
    if (id) return groupTarget(kind, id);
  }
  for (const kind of PLACE_KINDS) {
    const value = searchValue(search.get(kind));
    if (value) return placeTarget(kind, kind === "place" ? value : placeSlug(value));
  }
  return undefined;
}

/**
 * Where the pipeline edits what a portfolio link shows, such as the photo editor for
 * `https://servenupphotos.net/photos/512/` or `/grid?photo=512`, an album's page for
 * `/albums/japan`, or the Places page for `/maps/city/seoul/`; or why it can't.
 */
export function quickEditTarget(text: string): QuickEditTarget | QuickEditError {
  const url = parseLink(text);
  if (!url) return { error: "That isn't a link. Paste a link from the portfolio." };
  if (!isPortfolioHost(url.hostname))
    return { error: `That link is to ${url.hostname}, not the portfolio (servenupphotos.net).` };
  // A photo open in a view wins over the view itself, as on `/albums/japan?photo=512`.
  const photo = searchValue(url.searchParams.get("photo"));
  // A view filtered on one thing, such as `/grid?tag=sunset`, opens that thing before the view's
  // own page in the pipeline, such as Tags for `/tags`.
  const target =
    (photo && photoTarget(photo)) ||
    pathTarget(url.pathname) ||
    searchTarget(url.searchParams) ||
    PAGES[`/${pathParts(url.pathname).join("/")}`];
  return target ?? { error: NO_MATCH };
}

/**
 * The key of the Places list's row that Quick Edit's `edit` names (`city/seoul`, `place/<id>`), or
 * "" when no row matches. A place matches by its ID, a country, state or city by its name's slug.
 */
export function placeKeyForEdit(nodes: readonly RegionNode[], edit: string | undefined): string {
  const [kind, slug] = (edit ?? "").split("/", 2);
  if (!kind || !slug) return "";
  const node = nodes.find(
    (n) => n.kind === kind && (n.place ? n.place.id === slug : placeSlug(n.name) === slug),
  );
  return node?.key ?? "";
}
