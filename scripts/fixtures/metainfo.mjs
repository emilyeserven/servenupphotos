// Sample answers for the routes in routes_metainfo.go.
import { FOLDER, added, pendingSave } from "./shared.mjs";

/** The sample answers for the metainfo routes, keyed "METHOD /api/path". */
export function metainfoFixtures() {
  return {
    "PUT /api/metainfo/lens-brands": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/metainfo/lens-brands.json`,
      data: body,
      before: added.metainfo[2].data,
      changed: true,
    }),
    "DELETE /api/metainfo/iso-high": () => ({
      ...pendingSave(),
      path: `${FOLDER}/metainfo/iso-high.json`,
      data: null,
      before: added.metainfo[1].data,
      changed: true,
    }),
  };
}
