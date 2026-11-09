// Sample answers for the routes router.go registers itself (health check, hello and EXIF).
import { added } from "./shared.mjs";

/**
 * What reading a JPEG's EXIF answers on the Photo page: the photo data pull request's own photo, as
 * if the JPEG were a re-edit of it, with its EXIF stripped the way an edited export often has it.
 */
function reEditExif(data) {
  const { width, height } = data;
  const fields = Object.fromEntries(Object.keys(data).map((key) => [key, null]));
  return {
    file: data.file,
    exif: { ImageWidth: width, ImageHeight: height },
    sanitized: { ...fields, width, height, images: {}, exifOriginals: null },
    colors: null,
  };
}

/** The sample answers for the router routes, keyed "METHOD /api/path". */
export function routerFixtures() {
  return {
    "GET /api/health": { status: "ok", bff: "ok", backend: "ok" },
    "GET /api/hello": { message: "Hello from be-pipeline (Go)" },
    "POST /api/exif": () => reEditExif(added.photo.data),
  };
}
