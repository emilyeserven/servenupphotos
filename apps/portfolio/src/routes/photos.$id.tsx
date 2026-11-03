import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseShownPhoto } from "@/lib/shown-photo";

/**
 * A photo's own page, the link the photo viewer's Copy link button copies. The build writes one
 * for each photo with its link preview tags (photo-previews.ts); in the app it opens the photo on
 * the Grid.
 */
export const Route = createFileRoute("/photos/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/grid", search: parseShownPhoto({ photo: params.id }), replace: true });
  },
});
