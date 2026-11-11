// Sample answers for the routes in routes_publish.go.
import {
  CDN,
  FOLDER,
  PULL_REQUEST,
  REPO,
  added,
  fileUrl,
  headPhotos,
  imagesOf,
  pendingSave,
} from "./shared.mjs";

/**
 * A photo as the Instagram calendar and the photo page's Spotlight card read it: the first is scheduled, every other
 * one eligible.
 */
function socialPhoto({ path: filePath, data }, i) {
  const images = imagesOf(data);
  const socialMediaPublishDate = i === 0 ? "2026-10-23" : null;
  return {
    path: filePath,
    fileUrl: fileUrl(filePath, PULL_REQUEST.branch),
    file: data.file,
    gpsPosition: data.gpsPosition,
    createDate: data.createDate,
    title: data.title,
    image: images.thumbnail ?? images.xsmall ?? null,
    isSocialMediaEligible: i % 2 === 0,
    socialMediaPublishDate,
    data: { ...data, socialMediaPublishDate },
    "PUT /api/photobooks/sample-book": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/photobooks/sample-book.json`,
      data: { ...body, id: "sample-book" },
      before: added.photobooks[0].data,
      changed: true,
    }),
    "DELETE /api/photobooks/sample-book": () => ({
      ...pendingSave(),
      path: `${FOLDER}/photobooks/sample-book.json`,
      data: null,
      before: added.photobooks[0].data,
      changed: true,
    }),
  };
}

/** A photo file as /api/attention answers it: the Instagram calendar's, with its data cut down. */
function attentionPhoto(file, i) {
  const photo = socialPhoto(file, i);
  const {
    images: _images,
    exifOriginals: _exifOriginals,
    notes: _notes,
    comment: _comment,
    altText: _altText,
    colors,
    ...rest
  } = photo.data;
  const peakChroma = colors?.peakChroma;
  return { ...photo, data: peakChroma === undefined ? rest : { ...rest, colors: { peakChroma } } };
}

/**
 * Saving and removing the setting file folder/id, which was before: `PUT` answers the body as
 * saved made into the file's data, and `DELETE` answers it removed.
 */
function entryFixtures(folder, id, before, saved) {
  const path = `${FOLDER}/${folder}/${id}.json`;
  return {
    [`PUT /api/${folder}/${id}`]: ({ body }) => ({
      ...pendingSave(),
      path,
      data: saved(body),
      before,
      changed: true,
    }),
    [`DELETE /api/${folder}/${id}`]: () => ({
      ...pendingSave(),
      path,
      data: null,
      before,
      changed: true,
    }),
  };
}

/** The sample answers for the publish routes, keyed "METHOD /api/path". */
export function publishFixtures() {
  return {
    "GET /api/publish/instagram": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photos: headPhotos.map(socialPhoto),
      unreadable: [],
    },
    // The same files cut down, as the Dashboard's Needs attention reads them.
    "GET /api/attention": {
      repo: REPO,
      folder: `${FOLDER}/photos`,
      branch: PULL_REQUEST.branch,
      pullRequest: { number: PULL_REQUEST.number, url: PULL_REQUEST.url },
      photos: headPhotos.map(attentionPhoto),
      unreadable: [],
    },
    "PUT /api/publish/instagram": ({ body }) => ({ ...pendingSave(), files: body?.dates?.length }),
    ...entryFixtures("notstored", "2026-11-11", added.notstored[1].data, (body) => ({
      ...body,
      id: "2026-11-11",
      day: "2026-11-11",
    })),
    ...entryFixtures("photobooks", "sample-book", added.photobooks[0].data, (body) => ({
      ...body,
      id: "sample-book",
    })),
    "PUT /api/bio/bio": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/bio/bio.json`,
      data: { ...body, id: "bio" },
      before: added.bio[0].data,
      changed: true,
    }),
    "POST /api/bio/portrait": {
      image: `${CDN}/bio/2b3c4d5e6f7a-portrait.webp`,
      small: `${CDN}/bio/2b3c4d5e6f7a-portrait-small.webp`,
      width: 1800,
      height: 1200,
    },
  };
}
