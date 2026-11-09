// Sample answers for the routes in routes_captions.go.
import { FOLDER, added, pendingSave } from "./shared.mjs";

/** The sample answers for the captions routes, keyed "METHOD /api/path". */
export function captionsFixtures() {
  return {
    "DELETE /api/captions/instagram": () => ({
      ...pendingSave(),
      path: `${FOLDER}/captions/instagram.json`,
      data: null,
      before: added.captions[0].data,
      changed: true,
    }),
    "PUT /api/captions/instagram": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/captions/instagram.json`,
      data: body,
      before: added.captions[0].data,
      changed: true,
    }),
  };
}
