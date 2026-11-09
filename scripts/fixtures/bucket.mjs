// Sample answers for the routes in routes_bucket.go.
import { CDN, VERSIONS, headPhotos } from "./shared.mjs";

/** Every object an upload puts in R2 for each photo, newest photo first. */
function bucketImages() {
  return headPhotos
    .filter(({ data }) => data.images?.key)
    .toReversed()
    .flatMap(({ data }, i) => {
      const key = data.images.key;
      const stem = key.replace(/\.jpe?g$/, "");
      const modified = new Date(Date.UTC(2026, 9, 20 - i, 12)).toISOString();
      return [key, ...VERSIONS.map((version) => `${stem}-${version}.webp`)].map((k, j) => ({
        key: k,
        url: `${CDN}/${k}`,
        size: j === 0 ? 14_200_000 : 180_000 >> Math.min(j, 6),
        modified,
      }));
    });
}

/** The sample answers for the bucket routes, keyed "METHOD /api/path". */
export function bucketFixtures() {
  return {
    "GET /api/photos/bucket": { bucket: "servenupphotos", images: bucketImages() },
    "POST /api/photos/bucket/delete": ({ body }) => ({ deleted: body.keys, failed: [] }),
    "GET /api/photos/bucket/thumbnail-crop": ({ url }) => {
      const key = url.searchParams.get("key") ?? "";
      const photo = headPhotos.find(({ data }) => data.images?.key === key);
      const crop = photo?.data.images?.thumbnailcrop;
      return { key, crop: crop ? { x: crop.x, y: crop.y, size: crop.size } : null };
    },
    "POST /api/photos/bucket/versions": ({ body }) => ({ key: body?.key ?? "", versions: {} }),
    "POST /api/photos/bucket/exif": {
      file: "DSCF3104.jpg",
      exif: {
        Make: "FUJIFILM",
        Model: "X-T5",
        LensMake: "7Artisans",
        LensModel: "",
        Lens: "21.0 mm",
        LensInfo: "21mm f/?",
        FocalLength: "21.0 mm",
        FocalLengthIn35mmFormat: "32 mm",
        FNumber: 0,
        ExposureTime: "1/250",
        ISO: 400,
        SerialNumber: "5CA12345",
      },
      sanitized: null,
      colors: null,
    },
  };
}
