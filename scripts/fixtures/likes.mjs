// Sample answers for the routes in routes_likes.go.
import { FOLDER, added, pendingSave } from "./shared.mjs";

/** The sample answers for the likes routes, keyed "METHOD /api/path". */
export function likesFixtures() {
  return {
    "DELETE /api/likes/jane": () => ({
      ...pendingSave(),
      path: `${FOLDER}/likes/jane.json`,
      data: null,
      before: added.likes[0].data,
      changed: true,
    }),
    "PUT /api/likes/jane": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/likes/jane.json`,
      data: { ...body, importedAt: "2026-11-03T03:32:11Z" },
      before: added.likes[0].data,
      changed: true,
    }),
  };
}
