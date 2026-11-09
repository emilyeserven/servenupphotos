// Sample answers for the pipeline's /api routes, so `pnpm shot pipeline …` can show every page
// without the Go backend, R2 or GitHub. They're built from the committed portfolio data in
// apps/portfolio/src/data, so they keep up with the photo JSON's fields on their own, plus one
// "Add photo data" pull request that adds a photo, an album and a tag.
//
// Each key is "METHOD /api/path" (no query string). A value is the JSON body to answer with, or a
// function of the request ({ url, body }) that returns { status, body } or a body.
// To change an answer for one screenshot, pass `--fixtures my-fixtures.mjs`, a module whose
// default export takes these fixtures and returns the ones to use.
//
// The answers live in scripts/fixtures: one file per backend area (routes_<area>.go), plus
// shared.mjs for the portfolio data and pull request they are built from. This file merges them.
import { bucketFixtures } from "./fixtures/bucket.mjs";
import { camerasFixtures } from "./fixtures/cameras.mjs";
import { captionsFixtures } from "./fixtures/captions.mjs";
import { dataFixtures } from "./fixtures/data.mjs";
import { graphsFixtures } from "./fixtures/graphs.mjs";
import { inflightFixtures } from "./fixtures/inflight.mjs";
import { likesFixtures } from "./fixtures/likes.mjs";
import { metainfoFixtures } from "./fixtures/metainfo.mjs";
import { organizeFixtures } from "./fixtures/organize.mjs";
import { photosFixtures } from "./fixtures/photos.mjs";
import { placesFixtures } from "./fixtures/places.mjs";
import { publishFixtures } from "./fixtures/publish.mjs";
import { routerFixtures } from "./fixtures/router.mjs";
import { settingsFixtures } from "./fixtures/settings.mjs";
import { triplinesFixtures } from "./fixtures/triplines.mjs";
import { tripsFixtures } from "./fixtures/trips.mjs";
import { headPhotos, imagesOf } from "./fixtures/shared.mjs";

/** Merges each area's answers into one object, and throws if two areas answer the same route. */
function merge(areas) {
  const merged = {};
  for (const area of areas) {
    for (const [key, answer] of Object.entries(area)) {
      if (key in merged) throw new Error(`Two fixture files answer ${key}.`);
      merged[key] = answer;
    }
  }
  return merged;
}

/** The default answers: everything set up, and one photo data pull request open. */
export function defaultFixtures() {
  return merge([
    bucketFixtures(),
    camerasFixtures(),
    captionsFixtures(),
    dataFixtures(),
    graphsFixtures(),
    inflightFixtures(),
    likesFixtures(),
    metainfoFixtures(),
    organizeFixtures(),
    photosFixtures(),
    placesFixtures(),
    publishFixtures(),
    routerFixtures(),
    settingsFixtures(),
    triplinesFixtures(),
    tripsFixtures(),
  ]);
}

/** Each R2 object's photo, by its key without the extension or version, for placeholder images. */
export function photoSizes() {
  return new Map(
    headPhotos
      .filter(({ data }) => imagesOf(data).key)
      .map(({ data }) => [
        data.images.key.replace(/^photos\/|\.jpe?g$/g, ""),
        { width: data.width, height: data.height },
      ]),
  );
}
