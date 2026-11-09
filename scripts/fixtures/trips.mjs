// Sample answers for the routes in routes_trips.go.
import { FOLDER, added, pendingSave } from "./shared.mjs";

/** The sample answers for the trips routes, keyed "METHOD /api/path". */
export function tripsFixtures() {
  return {
    "POST /api/trips/combine": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/timeline/${body.trip.id}.json`,
      data: body.trip,
    }),
    "DELETE /api/trips/japan-2026-09-22": () => ({
      ...pendingSave(),
      path: `${FOLDER}/timeline/japan-2026-09-22.json`,
      data: null,
      before: added.timeline[0].data,
      changed: true,
    }),
    "PUT /api/trips/japan-2026-09-22": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/timeline/japan-2026-09-22.json`,
      data: body,
      before: added.timeline[0].data,
      changed: true,
    }),
  };
}
