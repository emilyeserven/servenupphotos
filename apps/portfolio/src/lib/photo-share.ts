import { photoPageUrl } from "@/lib/shown-photo";

/** The search key that keeps, in a photo's own link, the page it was copied from. */
const FROM = "from";

/**
 * The link the photo viewer's Copy link button copies: the photo's own page, which shows the
 * photo when shared, with the page it's open on and that page's settings in its search, such as
 * `/photos/512/?from=%2Ftimeline&thumbs=large`. GitHub Pages ignores the search, so the preview
 * still works, and `photoReturnHref` turns it back into the page with the photo open.
 */
export function photoShareUrl(id: number): string {
  const url = new URL(photoPageUrl(id));
  const settings = new URLSearchParams(window.location.search);
  settings.delete("photo");
  settings.delete(FROM);
  url.search = new URLSearchParams([[FROM, window.location.pathname], ...settings]).toString();
  return url.href;
}

/** Whether a link's `from` is a page of this site to go back to, rather than another site or a photo's own page. */
function isPagePath(path: string | null): path is string {
  return Boolean(path?.startsWith("/")) && !path!.startsWith("//") && !path!.startsWith("/photos/");
}

/**
 * Where a photo's own page sends the visitor: the page and settings its link was copied from
 * with the photo open, or the Grid with the photo open for a link without them.
 */
export function photoReturnHref(id: string, searchStr: string): string {
  const search = new URLSearchParams(searchStr);
  const from = search.get(FROM);
  search.delete(FROM);
  search.set("photo", id);
  return `${isPagePath(from) ? from : "/grid"}?${search}`;
}
