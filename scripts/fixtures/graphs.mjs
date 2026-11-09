// Sample answers for the routes in routes_graphs.go.
import { FOLDER, added, pendingSave } from "./shared.mjs";

/** The sample answers for the graphs routes, keyed "METHOD /api/path". */
export function graphsFixtures() {
  return {
    "DELETE /api/graphs/time-of-day": () => ({
      ...pendingSave(),
      path: `${FOLDER}/graphs/time-of-day.json`,
      data: null,
      before: added.graphs[2].data,
      changed: true,
    }),
    "PUT /api/graphs/time-of-day": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/graphs/time-of-day.json`,
      data: body,
      before: added.graphs[2].data,
      changed: true,
    }),
  };
}
