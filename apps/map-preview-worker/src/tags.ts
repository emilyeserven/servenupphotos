/**
 * The link preview tags (Open Graph and Twitter card `<meta>` tags) the Worker puts into a page's
 * HTML, and how it swaps them in for the ones the page already has.
 *
 * > **Frontend analogy:** `HTMLRewriter` is like a `MutationObserver` that edits the HTML as it
 * > streams past, before any browser or link preview bot sees it.
 */

/** One `<meta>` tag: whether it's keyed by `property` (Open Graph) or `name`, its key, and its content. */
export interface MetaTag {
  attribute: "property" | "name";
  key: string;
  content: string;
}

/** A page's title and its link preview tags. */
export interface Preview {
  title: string;
  tags: MetaTag[];
}

/** The tags a page already has that a preview replaces. */
const PREVIEW_SELECTORS = [
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'meta[name="description"]',
];

/** The text with `&`, `<`, `>` and `"` written so it can go inside HTML. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The tag as HTML. */
function tagHtml({ attribute, key, content }: MetaTag): string {
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`;
}

/** Open Graph tags from key and content pairs. */
export function ogTags(pairs: [string, string][]): MetaTag[] {
  return pairs.map(([key, content]) => ({ attribute: "property", key, content }));
}

/** Tags keyed by `name`, such as Twitter's, from key and content pairs. */
export function nameTags(pairs: [string, string][]): MetaTag[] {
  return pairs.map(([key, content]) => ({ attribute: "name", key, content }));
}

/** The preview with its `og:url` set to the address, so a shared link opens where it was shared from. */
export function withUrl(preview: Preview, url: string): Preview {
  const others = preview.tags.filter((tag) => tag.key !== "og:url");
  return { ...preview, tags: [...others, ...ogTags([["og:url", url]])] };
}

/**
 * The page with its title and preview tags swapped for the preview's. A page GitHub Pages answers
 * with its "not found" page (every app route, as the app is one page) is sent as found, since link
 * preview bots skip pages that aren't.
 */
export function withPreview(page: Response, preview: Preview): Response {
  let rewriter = new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(preview.title) })
    .on("head", {
      element: (el) => void el.append(preview.tags.map(tagHtml).join(""), { html: true }),
    });
  for (const selector of PREVIEW_SELECTORS) {
    rewriter = rewriter.on(selector, { element: (el) => void el.remove() });
  }
  const rewritten = rewriter.transform(page);
  const headers = new Headers(rewritten.headers);
  headers.delete("content-length");
  return new Response(rewritten.body, { status: 200, headers });
}

/** Reads a page's title and its preview tags, such as a photo's page at `/photos/<id>/`. */
export async function readPreview(page: Response): Promise<Preview> {
  const preview: Preview = { title: "", tags: [] };
  const keep = (attribute: MetaTag["attribute"]) => ({
    element(el: Element) {
      const key = el.getAttribute(attribute);
      const content = el.getAttribute("content");
      if (key && content !== null)
        preview.tags.push({ attribute, key, content: unescapeHtml(content) });
    },
  });
  await new HTMLRewriter()
    .on("title", { text: (text) => void (preview.title += text.text) })
    .on('meta[property^="og:"]', keep("property"))
    .on('meta[name^="twitter:"], meta[name="description"]', keep("name"))
    .transform(page)
    .arrayBuffer();
  return { ...preview, title: unescapeHtml(preview.title) };
}

/**
 * The text with the entities escapeHtml writes turned back into characters, as HTMLRewriter gives
 * attributes and text as they're written in the HTML.
 */
function unescapeHtml(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}
