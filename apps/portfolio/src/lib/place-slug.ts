/**
 * A country, state or city name as it goes in a map page's address, such as `seoul` in
 * `/maps/city/seoul/`: lowercase letters and digits with dashes, or else encoded. The pipeline's
 * Quick Edit reads it back to find the place on the Places page.
 */
export function placeSlug(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || encodeURIComponent(name);
}
