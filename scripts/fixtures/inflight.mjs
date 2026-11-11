// Sample answers for the routes in routes_inflight.go.
import {
  BASE_BRANCH,
  CDN,
  FOLDER,
  PULL_REQUEST,
  REPO,
  added,
  basePhotos,
  fileUrl,
  imagesOf,
} from "./shared.mjs";

/** Each photo's original in R2, keyed by its JSON file's path. */
function imagesByPath(files) {
  const byPath = {};
  for (const { path: filePath, data } of files) {
    if (data.images?.key) {
      byPath[filePath] = { key: data.images.key, url: `${CDN}/${data.images.key}` };
    }
  }
  return { checked: true, byPath };
}

function photoFile({ path: filePath, data }, status, branch) {
  const images = imagesOf(data);
  return {
    path: filePath,
    status,
    fileUrl: fileUrl(filePath, branch),
    data,
    photoName: data.file,
    imageUrl: images.full,
    imageKey: images.key,
  };
}

const groupFile = ({ path: filePath, data }) => ({
  path: filePath,
  status: "added",
  fileUrl: fileUrl(filePath, PULL_REQUEST.branch),
  data,
});

/** Where a photo editor save puts the file: moved to `name` in its folder when that's given. */
function savedPath({ path, name }) {
  return name ? path.replace(/[^/]+$/, `${name}.json`) : path;
}

/** The sample answers for the inflight routes, keyed "METHOD /api/path". */
export function inflightFixtures() {
  return {
    "GET /api/photos/in-flight": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      pullRequest: PULL_REQUEST,
      files: [photoFile(added.photo, "added", PULL_REQUEST.branch)],
      albums: { folder: `${FOLDER}/albums`, files: [groupFile(added.album)] },
      tags: { folder: `${FOLDER}/tags`, files: [groupFile(added.tag)] },
      genres: { folder: `${FOLDER}/genres`, files: added.genres.map(groupFile) },
      places: { folder: `${FOLDER}/places`, files: added.places.map(groupFile) },
      localizations: {
        folder: `${FOLDER}/localizations`,
        files: added.localizations.map(groupFile),
      },
      metainfo: { folder: `${FOLDER}/metainfo`, files: added.metainfo.map(groupFile) },
      cameras: { folder: `${FOLDER}/cameras`, files: added.cameras.map(groupFile) },
      lenses: { folder: `${FOLDER}/lenses`, files: added.lenses.map(groupFile) },
      captions: { folder: `${FOLDER}/captions`, files: added.captions.map(groupFile) },
      timeline: { folder: `${FOLDER}/timeline`, files: added.timeline.map(groupFile) },
      likes: { folder: `${FOLDER}/likes`, files: added.likes.map(groupFile) },
      triplines: { folder: `${FOLDER}/triplines`, files: added.triplines.map(groupFile) },
      graphs: { folder: `${FOLDER}/graphs`, files: added.graphs.map(groupFile) },
      gear: { folder: `${FOLDER}/gear`, files: added.gear.map(groupFile) },
      notstored: { folder: `${FOLDER}/notstored`, files: added.notstored.map(groupFile) },
      photobooks: { folder: `${FOLDER}/photobooks`, files: added.photobooks.map(groupFile) },
      images: imagesByPath([added.photo]),
    },
    "GET /api/photos/published": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: BASE_BRANCH,
      pullRequest: PULL_REQUEST,
      files: basePhotos.map((file) => photoFile(file, "published")),
      images: imagesByPath(basePhotos),
    },
    "DELETE /api/photos/in-flight": () => ({
      path: added.photo.path,
      before: added.photo.data,
      image: { key: "originals/DSCF3104.jpg", deleted: true, versions: [] },
    }),
    "PUT /api/photos/in-flight": ({ body = {} }) => ({
      path: savedPath(body),
      changed: true,
      pullRequestUrl: PULL_REQUEST.url,
      before: null,
      data: body.data ?? {},
    }),
  };
}
