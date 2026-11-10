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
    "GET /api/photos/bucket/faces": ({ url }) => ({
      key: url.searchParams.get("key") ?? "",
      faces: [],
    }),
    // Two found faces, placed on the placeholder photo `pnpm shot` draws.
    "POST /api/photos/bucket/faces/detect": ({ body }) => ({
      key: body.key,
      faces: sampleFaces(headPhotos.find(({ data }) => data.images?.key === body.key)),
    }),
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

/**
 * Two face boxes, as face finding answers, on the placeholder `pnpm shot` draws for photo: 1200 px
 * wide in the photo's proportions (3:2 when it isn't found), one boxing the placeholder's sun.
 */
function sampleFaces(photo) {
  const { width = 3, height = 2 } = photo?.data ?? {};
  const [w, h] = [1200, Math.round((1200 * height) / width)];
  const side = Math.round(Math.min(w, h) * 0.26);
  const face = (cx, cy) => ({
    x: Math.round(cx - side / 2),
    y: Math.round(cy - side / 2),
    width: side,
    height: side,
    blocks: 8,
  });
  return [face(w * 0.7, h * 0.32), face(w * 0.3, h * 0.45)];
}
