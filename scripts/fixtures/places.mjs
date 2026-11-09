// Sample answers for the routes in routes_places.go.
import {
  FOLDER,
  PULL_REQUEST,
  REPO,
  added,
  headLocalizations,
  headPlaces,
  pendingSave,
} from "./shared.mjs";

/** The sample answers for the places routes, keyed "METHOD /api/path". */
export function placesFixtures() {
  return {
    "PUT /api/localizations/country-united-states-of-america": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/localizations/country-united-states-of-america.json`,
      data: body,
      before: null,
      changed: true,
    }),
    "PUT /api/places/gyeongbokgung-palace": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/places/gyeongbokgung-palace.json`,
      data: body,
      before: added.places[0].data,
      changed: true,
    }),
    "PUT /api/places/washington-square-park/area": () => ({
      ...pendingSave(),
      path: `${FOLDER}/places/washington-square-park.geo.json`,
      changed: true,
    }),
    "DELETE /api/places/washington-square-park/area": () => ({
      ...pendingSave(),
      path: `${FOLDER}/places/washington-square-park.geo.json`,
      changed: true,
    }),
    // Places with no area, which the Trip Lines map circles instead.
    "GET /api/places/waveny-park/area": null,
    "GET /api/places/bristow-bird-sanctuary/area": null,
    "GET /api/places/new-canaan-nature-center/area": null,
    "GET /api/places/namba/area": null,
    "GET /api/places/dotonbori/area": null,
    "GET /api/places/engyoji-temple/area": null,
    "GET /api/places/sannomiya/area": null,
    "GET /api/places/washington-square-park/area": {
      osm: "R1",
      shape: [
        [
          [
            [-73.9995, 40.7303],
            [-73.9964, 40.7295],
            [-73.9953, 40.7315],
            [-73.9985, 40.7322],
            [-73.9995, 40.7303],
          ],
        ],
      ],
    },
    "GET /api/places": {
      repo: REPO,
      folder: FOLDER,
      branch: PULL_REQUEST.branch,
      pullRequest: PULL_REQUEST,
      places: headPlaces,
      localizations: headLocalizations,
    },
  };
}
