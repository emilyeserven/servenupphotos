// Sample answers for the routes in routes_organize.go.
import {
  BASE_BRANCH,
  FOLDER,
  PULL_REQUEST,
  REPO,
  added,
  baseAlbums,
  baseGenres,
  baseTags,
  group,
  headPhotos,
  pendingSave,
  savedPhoto,
} from "./shared.mjs";

/** What adding albums, tags and genres to photos saves: each photo file before and after. */
function groupsAdded({ paths = [], ...add } = {}) {
  const changes = headPhotos
    .filter((file) => paths.includes(file.path))
    .map(({ path: filePath, data }) => ({
      path: filePath,
      before: data,
      after: withGroupsAdded(data, add),
    }));
  return { ...pendingSave(), changes, files: changes.length };
}

/** The photo's data with each album, tag and genre in add that it doesn't list yet. */
function withGroupsAdded(data, add) {
  const next = { ...data };
  for (const kind of ["albums", "tags", "genres"]) {
    next[kind] = [...new Set([...(data[kind] ?? []), ...(add[kind] ?? [])])];
  }
  return next;
}

/** The sample answers for the organize routes, keyed "METHOD /api/path". */
export function organizeFixtures() {
  return {
    "PUT /api/organize/albums/japan/parent": () => ({
      ...pendingSave(),
      path: `${FOLDER}/albums/japan.json`,
      changed: true,
    }),
    "GET /api/organize": {
      repo: REPO,
      folder: FOLDER,
      branch: BASE_BRANCH,
      pullRequest: PULL_REQUEST,
      albums: [...baseAlbums.map((f) => group(f, false)), group(added.album, true)],
      tags: [...baseTags.map((f) => group(f, false)), group(added.tag, true)],
      genres: [
        ...baseGenres.map((f) => group(f, false)),
        ...added.genres.map((f) => group(f, true)),
      ],
    },
    "POST /api/organize/tags": ({ body = {} }) =>
      savedPhoto(`${FOLDER}/tags/${body.id}.json`, { ...body, description: "" }),
    "POST /api/organize/genres": ({ body = {} }) =>
      savedPhoto(`${FOLDER}/genres/${body.id}.json`, { ...body, description: "" }),
    "PUT /api/organize/albums/order": ({ body }) => ({
      ...pendingSave(),
      files: body?.ids?.length,
    }),
    "PUT /api/organize/albums/homepage-spotlight/photo-order": { ...pendingSave(), files: 1 },
    "PUT /api/organize/albums/homepage-spotlight/layout": { ...pendingSave(), files: 1 },
    "DELETE /api/organize/albums/homepage-spotlight": {
      ...pendingSave(),
      photos: 10,
      reparented: 0,
    },
    "DELETE /api/organize/albums/homepage-spotlight/photos": ({ body }) => ({
      ...pendingSave(),
      photos: body?.photoIds?.length ?? 0,
    }),
    "DELETE /api/organize/albums/japan/photos": ({ body }) => ({
      ...pendingSave(),
      photos: body?.photoIds?.length ?? 0,
    }),
    "PUT /api/organize/albums/homepage-spotlight/visibility": { ...pendingSave(), files: 1 },
    "PUT /api/organize/albums/japan/rules": { ...pendingSave(), files: 1 },
    "PUT /api/organize/tags/names": { ...pendingSave(), files: 1 },
    "PUT /api/organize/tags/descriptions": ({ body }) => ({
      ...pendingSave(),
      files: Object.keys(body?.descriptions ?? {}).length,
    }),
    "PUT /api/organize/tags/favorites": ({ body }) => ({
      ...pendingSave(),
      files: Object.keys(body?.favorites ?? {}).length,
    }),
    "PUT /api/organize/spotlight/homepage": { ...pendingSave(), files: 2 },
    "POST /api/photos/groups": ({ body }) => groupsAdded(body),
  };
}
