import { createFileRoute, redirect } from "@tanstack/react-router";
import { mapPages } from "@/lib/map-pages";

/**
 * A place's map page, the link the map's Copy link button copies. The build writes one for each
 * country, state, city and place with photos, with a picture of its view as the link preview
 * (map-preview/pages.ts); in the app it opens the map on that view, or on every photo for a place
 * it doesn't know.
 */
export const Route = createFileRoute("/maps/$kind/$slug")({
  beforeLoad: ({ params }) => {
    const page = mapPages.get(`/maps/${params.kind}/${params.slug}/`);
    throw redirect({ to: "/map", search: page?.view ?? {}, replace: true });
  },
});
