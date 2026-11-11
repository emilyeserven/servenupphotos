// Sample answers for the routes in routes_photos.go.
import {
  BASE_BRANCH,
  CDN,
  FOLDER,
  PULL_REQUEST,
  REPO,
  VERSIONS,
  added,
  baseAlbums,
  baseGenres,
  baseLocalizations,
  basePhotos,
  basePlaces,
  baseTags,
  fileUrl,
  headLocalizations,
  headPhotos,
  headPlaces,
  headTags,
  readFolder,
  savedPhoto,
  withAdded,
} from "./shared.mjs";

const baseMetaInfo = readFolder("metainfo", "METAINFO");

const baseCameras = readFolder("cameras", "CAMERAS");

const baseLenses = readFolder("lenses", "LENSES");

const baseCaptions = readFolder("captions", "CAPTIONS");

const baseTimeline = readFolder("timeline", "TIMELINE");

const baseLikes = readFolder("likes", "LIKES");

const baseTripLines = readFolder("triplines", "TRIPLINES");

const baseGraphs = readFolder("graphs", "GRAPHS");

const baseGear = readFolder("gear", "GEAR");

const baseNotStored = readFolder("notstored", "NOTSTORED");

const basePhotoBooks = readFolder("photobooks", "PHOTOBOOKS");

const headAlbums = [...baseAlbums, added.album];

const headGenres = [...baseGenres, ...added.genres];

const headMetaInfo = withAdded(baseMetaInfo, added.metainfo);

const headCameras = withAdded(baseCameras, added.cameras);

const headLenses = withAdded(baseLenses, added.lenses);

const headCaptions = withAdded(baseCaptions, added.captions);

const headTimeline = withAdded(baseTimeline, added.timeline);

const headLikes = withAdded(baseLikes, added.likes);

const headTripLines = withAdded(baseTripLines, added.triplines);

const headGraphs = withAdded(baseGraphs, added.graphs);

const headGear = withAdded(baseGear, added.gear);

const headNotStored = withAdded(baseNotStored, added.notstored);

const headPhotoBooks = withAdded(basePhotoBooks, added.photobooks);

function combinedFile(kind, all, files, branch) {
  const filePath = `${FOLDER}/${kind}/${all}`;
  return {
    path: filePath,
    found: true,
    fileUrl: fileUrl(filePath, branch),
    count: files.length,
    data: files.map((file) => file.data),
  };
}

function combinedFiles(
  [
    photos,
    albums,
    tags,
    genres,
    places,
    localizations,
    metainfo,
    cameras,
    lenses,
    captions,
    timeline,
    likes,
    triplines,
    graphs,
    gear,
    notstored,
    photobooks,
  ],
  branch,
) {
  return {
    photos: combinedFile("photos", "ALLPHOTOS.json", photos, branch),
    albums: combinedFile("albums", "ALLALBUMS.json", albums, branch),
    tags: combinedFile("tags", "ALLTAGS.json", tags, branch),
    genres: combinedFile("genres", "ALLGENRES.json", genres, branch),
    places: combinedFile("places", "PLACES.json", places, branch),
    localizations: combinedFile("localizations", "LOCALIZATIONS.json", localizations, branch),
    metainfo: combinedFile("metainfo", "METAINFO.json", metainfo, branch),
    cameras: combinedFile("cameras", "CAMERAS.json", cameras, branch),
    lenses: combinedFile("lenses", "LENSES.json", lenses, branch),
    captions: combinedFile("captions", "CAPTIONS.json", captions, branch),
    timeline: combinedFile("timeline", "TIMELINE.json", timeline, branch),
    likes: combinedFile("likes", "LIKES.json", likes, branch),
    triplines: combinedFile("triplines", "TRIPLINES.json", triplines, branch),
    graphs: combinedFile("graphs", "GRAPHS.json", graphs, branch),
    gear: combinedFile("gear", "GEAR.json", gear, branch),
    notstored: combinedFile("notstored", "NOTSTORED.json", notstored, branch),
    photobooks: combinedFile("photobooks", "PHOTOBOOKS.json", photobooks, branch),
  };
}

/** What uploading a JPEG to R2 answers: the photo at key, with every version next to it. */
function uploadAnswer(key) {
  const stem = key.replace(/\.jpe?g$/, "");
  const versions = Object.fromEntries(
    VERSIONS.map((name) => {
      const k = `${stem}-${name}.webp`;
      return [name, { key: k, url: `${CDN}/${k}` }];
    }),
  );
  return { key, url: `${CDN}/${key}`, versions };
}

/** The sample answers for the photos routes, keyed "METHOD /api/path". */
export function photosFixtures() {
  return {
    "GET /api/photos/combined": {
      repo: REPO,
      folder: FOLDER,
      base: {
        ...combinedFiles([
          basePhotos,
          baseAlbums,
          baseTags,
          baseGenres,
          basePlaces,
          baseLocalizations,
          baseMetaInfo,
          baseCameras,
          baseLenses,
          baseCaptions,
          baseTimeline,
          baseLikes,
          baseTripLines,
          baseGraphs,
          baseGear,
          baseNotStored,
          basePhotoBooks,
        ]),
        branch: BASE_BRANCH,
      },
      head: {
        ...combinedFiles(
          [
            headPhotos,
            headAlbums,
            headTags,
            headGenres,
            headPlaces,
            headLocalizations,
            headMetaInfo,
            headCameras,
            headLenses,
            headCaptions,
            headTimeline,
            headLikes,
            headTripLines,
            headGraphs,
            headGear,
            headNotStored,
            headPhotoBooks,
          ],
          PULL_REQUEST.branch,
        ),
        pullRequest: PULL_REQUEST,
      },
    },
    "GET /api/photos/combined/status": { state: "synced", headSha: PULL_REQUEST.headSha },
    "POST /api/upload": uploadAnswer("photos/0a1b2c3d4e5f-dscf3104.jpg"),
    "POST /api/photos/all-photos/check": {
      sources: [
        { label: `Pull request #${PULL_REQUEST.number}`, fileUrl: PULL_REQUEST.url, found: true },
      ],
      matches: [],
    },
    // Saves answer as the backend does: their changes wait for Commit, for the open pull request.
    "POST /api/photos/github": ({ body }) => savedPhoto(`${FOLDER}/photos/${body?.name}.json`),
    "DELETE /api/photos/pending": { discarded: 1 },
    "GET /api/photos/pending": {
      version: 1,
      repo: REPO,
      exported: "2026-10-30T06:44:08Z",
      files: [],
    },
    "POST /api/photos/pending": ({ body }) => ({
      restored: body?.files?.length ?? 0,
      unchanged: 0,
    }),
    "POST /api/photos/combined": () => ({
      changed: true,
      commitSha: "c0mb1ned",
      commitUrl: `https://github.com/${REPO}/commit/c0mb1ned`,
      files: [`${FOLDER}/photos/ALLPHOTOS.json`],
      edited: 0,
      counts: { photos: basePhotos.length + 1, albums: 1, tags: 1 },
      newPullRequest: false,
      pullRequestUrl: PULL_REQUEST.url,
      skipped: [],
    }),
  };
}
