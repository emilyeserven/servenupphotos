import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/** The portfolio's address, which link previews need in full. */
const SITE_URL = "https://servenupphotos.net";
const SITE_NAME = "Serven Up Photos";
/** The longest edge of the Medium version, the one link previews show. */
const MEDIUM_EDGE = 1200;
/** How much of a photo's comment a link preview's description keeps. */
const DESCRIPTION_LENGTH = 200;

/** The parts of a photo's entry in ALLPHOTOS.json that its link preview reads. */
interface PreviewPhoto {
  id?: number | null;
  title?: string | null;
  comment?: string | null;
  width: number | null;
  height: number | null;
  customCity?: string | null;
  customCountry?: string | null;
  city: string | null;
  country: string | null;
  images: { medium?: string | null };
}

/** A photo that can have a photo page: one with an ID and a Medium version. */
type PagePhoto = PreviewPhoto & { id: number; images: { medium: string } };

/** The address of a photo's page; `photoPageUrl` in src/lib/shown-photo.ts makes the same one. */
function photoPagePath(id: number): string {
  return `/photos/${id}/`;
}

/** The text with `&`, `<`, `>` and `"` written so it can go inside an HTML attribute. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The comment as one line of plain text, cut to fit a link preview, or "" without one. */
function commentText(comment: string | null | undefined): string {
  const plain = (comment ?? "")
    .replace(/[*_`#>[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > DESCRIPTION_LENGTH ? `${plain.slice(0, DESCRIPTION_LENGTH - 1)}…` : plain;
}

/** Where the photo was taken, as "City, Country", from the custom fields or else the EXIF ones. */
function placeText(photo: PreviewPhoto): string {
  const city = photo.customCity ?? photo.city;
  const country = photo.customCountry ?? photo.country;
  return [city, country].filter(Boolean).join(", ");
}

/** The link preview's description: the photo's comment, or else where it was taken. */
function descriptionOf(photo: PreviewPhoto): string {
  return commentText(photo.comment) || placeText(photo) || `A photo by ${SITE_NAME}.`;
}

/** The Medium version's size, the photo's size scaled so its longest edge is at most 1200px. */
function mediumSize(photo: PreviewPhoto): { width: number; height: number } | null {
  if (!photo.width || !photo.height) return null;
  const scale = Math.min(1, MEDIUM_EDGE / Math.max(photo.width, photo.height));
  return { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) };
}

/** The `og:image:width` and `og:image:height` tags, when the photo's size is known. */
function imageSizeTags(photo: PreviewPhoto): [string, string][] {
  const size = mediumSize(photo);
  if (!size) return [];
  return [
    ["og:image:width", String(size.width)],
    ["og:image:height", String(size.height)],
  ];
}

/** The Open Graph and Twitter card tags that make a link to the photo show the photo. */
function previewTags(photo: PagePhoto, title: string): string {
  const description = descriptionOf(photo);
  const properties: [string, string][] = [
    ["og:type", "article"],
    ["og:site_name", SITE_NAME],
    ["og:title", title],
    ["og:description", description],
    ["og:url", `${SITE_URL}${photoPagePath(photo.id)}`],
    ["og:image", photo.images.medium],
    ["og:image:alt", title],
    ...imageSizeTags(photo),
  ];
  const names: [string, string][] = [
    ["description", description],
    ["twitter:card", "summary_large_image"],
  ];
  return [
    ...properties.map(
      ([key, value]) => `<meta property="${key}" content="${escapeHtml(value)}" />`,
    ),
    ...names.map(([key, value]) => `<meta name="${key}" content="${escapeHtml(value)}" />`),
  ].join("\n    ");
}

/** The built index.html for one photo: its title, and its preview tags in place of the description. */
function photoPage(html: string, photo: PagePhoto): string {
  const title = photo.title?.trim() || SITE_NAME;
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(`${title} · ${SITE_NAME}`)}</title>`)
    .replace(/<meta name="description"[^>]*>/, previewTags(photo, title));
}

/** Whether the photo can have a photo page: it has an ID and a Medium version to show. */
function hasPage(photo: PreviewPhoto): photo is PagePhoto {
  return typeof photo.id === "number" && Boolean(photo.images?.medium);
}

/**
 * After a build, writes a page for each photo in ALLPHOTOS.json at `/photos/<id>/`: the built
 * index.html with the photo's title and Open Graph and Twitter card tags, so a link to it shows the
 * photo when shared. GitHub Pages serves it as is, and the app then opens the photo on the Grid.
 */
export function photoPreviewPages(dataFile: string): Plugin {
  return {
    name: "photo-preview-pages",
    apply: "build",
    async writeBundle(options) {
      const dir = options.dir ?? "dist";
      const html = await readFile(path.join(dir, "index.html"), "utf8");
      const photos = JSON.parse(await readFile(dataFile, "utf8")) as PreviewPhoto[];
      const pages = photos.filter(hasPage);
      for (const photo of pages) {
        const pageDir = path.join(dir, photoPagePath(photo.id));
        await mkdir(pageDir, { recursive: true });
        await writeFile(path.join(pageDir, "index.html"), photoPage(html, photo));
      }
      this.info(`Wrote ${pages.length} photo pages for link previews`);
    },
  };
}
