/**
 * The Cloudflare Worker in front of servenupphotos.net that gives shared links their preview
 * (see docs/map-link-previews.md):
 *
 * - a link with an open photo (`?photo=<id>`, on any page) shows that photo, with the tags from
 *   its page at `/photos/<id>/`;
 * - a map link (`/map?lat=…&lng=…&zoom=…`) shows a drawn map of that view with the photo pins;
 * - everything else goes to GitHub Pages untouched.
 *
 * > **Frontend analogy:** it's a service worker that runs on Cloudflare instead of in the browser:
 * > it sees each request first, can answer it itself or pass it on with `fetch(request)`, and can
 * > change the answer on its way back. Link preview bots never run the app's JavaScript, so the
 * > tags have to be in the HTML they're sent.
 */
import { IMAGE_PATH, loadPins, mapImage, mapPreview } from "./map.ts";
import { readPreview, withPreview, withUrl } from "./tags.ts";

/** What the Worker is given by wrangler.toml. */
interface Env {
  /** Where the built portfolio is served, for map-pins.json and photo pages. */
  SITE_ORIGIN: string;
  /** The R2 bucket the drawn map images are kept in. */
  PREVIEWS: R2Bucket;
  /** CARTO's basemaps API key, a secret set with `wrangler secret put CARTO_KEY`. */
  CARTO_KEY?: string;
}

/** Whether the request is for a page rather than a file: a GET for a path with no file extension. */
function isPage(request: Request, url: URL): boolean {
  return request.method === "GET" && !/\.[a-z0-9]+$/i.test(url.pathname);
}

/** The open photo's ID in the link, or null without one. */
function photoId(url: URL): number | null {
  const id = Number(url.searchParams.get("photo"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Whether the link is to the map. */
function isMap(url: URL): boolean {
  return url.pathname === "/map" || url.pathname === "/map/";
}

/** The page with the open photo's preview, or the page as it is when the photo has no page. */
async function photoPage(request: Request, url: URL, id: number, env: Env): Promise<Response> {
  const [html, photo] = await Promise.all([
    fetch(request),
    fetch(`${env.SITE_ORIGIN}/photos/${id}/`),
  ]);
  if (!photo.ok) return html;
  return withPreview(html, withUrl(await readPreview(photo), url.href));
}

/** The map page with its view's preview. */
async function mapPage(request: Request, url: URL, env: Env): Promise<Response> {
  const [html, pins] = await Promise.all([fetch(request), loadPins(env.SITE_ORIGIN)]);
  return withPreview(html, mapPreview(url, pins));
}

/** Answers a page request, adding the preview its link should have, if any. */
function page(request: Request, url: URL, env: Env): Promise<Response> {
  const id = photoId(url);
  if (id !== null) return photoPage(request, url, id, env);
  return isMap(url) ? mapPage(request, url, env) : fetch(request);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // If anything here fails, the request goes to GitHub Pages as if the Worker weren't there.
    ctx.passThroughOnException();
    const url = new URL(request.url);
    if (url.pathname === IMAGE_PATH)
      return mapImage(
        url,
        await loadPins(env.SITE_ORIGIN),
        { bucket: env.PREVIEWS, cartoKey: env.CARTO_KEY },
        ctx,
      );
    return isPage(request, url) ? page(request, url, env) : fetch(request);
  },
} satisfies ExportedHandler<Env>;
