import { createFileRoute } from "@tanstack/react-router";
import { TripCrumbs } from "@/components/sidebar/route-crumbs";
import { TripPage } from "@/components/trips/page";

// Not nested in the Trip Lines route, so the Trip's page replaces the tabs rather than sitting
// under them.
export const Route = createFileRoute("/trip-lines_/trips/$id")({
  component: TripRoute,
  staticData: { wide: true, crumbs: TripCrumbs },
});

function TripRoute() {
  const { id } = Route.useParams();
  return <TripPage id={id} />;
}
