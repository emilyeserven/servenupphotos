import { createFileRoute, redirect } from "@tanstack/react-router";
import { photoReturnHref } from "@/lib/photo-share";

/**
 * A photo's own page, the link the photo viewer's Copy link button copies. The build writes one
 * for each photo with its link preview tags (photo-previews.ts); in the app it opens the photo on
 * the page the link was copied from, with that page's settings, or else on the Grid.
 */
export const Route = createFileRoute("/photos/$id")({
  beforeLoad: ({ params, location }) => {
    const id = String(Number.parseInt(params.id, 10));
    throw redirect({ href: photoReturnHref(id, location.searchStr), replace: true });
  },
});
