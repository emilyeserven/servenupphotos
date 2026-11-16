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

/** Two sets of contact sheets made for prompts, newest first. */
function contactSheetImages() {
  const sets = [
    ["20261115-045000-1a2b3c4d", 3, "2026-11-15T04:50:00.000Z"],
    ["20261114-211500-9f8e7d6c", 1, "2026-11-14T21:15:00.000Z"],
  ];
  return sets.flatMap(([name, sheets, modified]) =>
    Array.from({ length: sheets }, (_, i) => {
      const key = `contact-sheets/${name}/sheet-${String(i + 1).padStart(2, "0")}.jpg`;
      return { key, url: `${CDN}/${key}`, size: 210_000, modified };
    }),
  );
}

/** The sample answers for the bucket routes, keyed "METHOD /api/path". */
export function bucketFixtures() {
  return {
    "GET /api/photos/bucket": {
      bucket: "servenupphotos",
      images: [...contactSheetImages(), ...bucketImages()],
    },
    "POST /api/photos/bucket/delete": ({ body }) => ({ deleted: body.keys, failed: [] }),
    // A sheet of 30 for every 30 photos asked for, in the contact-sheets/ folder R2 empties daily.
    "POST /api/photos/bucket/contact-sheets": ({ body }) => {
      const total = body?.photos?.length ?? 0;
      const sheets = Array.from({ length: Math.ceil(total / 30) }, (_, i) => ({
        url: `${CDN}/contact-sheets/20261115-045000-1a2b3c4d/sheet-${String(i + 1).padStart(2, "0")}.jpg`,
        first: i * 30 + 1,
        last: Math.min((i + 1) * 30, total),
      }));
      return { sheets, missing: [], expiryProblem: "" };
    },
    "POST /api/photos/bucket/contact-sheets/delete": () => ({ deleted: 3, failed: [] }),
    // Mostly the house ratios (16:9 and 5:7), with every 4th photo cropped 3:2 and every 9th 4:5.
    "POST /api/photos/bucket/sizes": ({ body }) => ({
      images: (body?.urls ?? []).map((url, i) => {
        if (i % 9 === 4) return { url, width: 512, height: 640 };
        if (i % 4 === 1) return { url, width: 640, height: 427 };
        return i % 3 === 2 ? { url, width: 457, height: 640 } : { url, width: 640, height: 360 };
      }),
    }),
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
