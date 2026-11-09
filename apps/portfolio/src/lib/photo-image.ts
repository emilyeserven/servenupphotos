/** A photo's resized versions in R2, as a view draws them. */
export interface PhotoImage {
  /** The photo's size in pixels, as it's shown. */
  width: number;
  height: number;
  /** The Medium version, or the largest one below it. */
  src: string;
  /** The Small version, or the smallest one above it, or else the largest there is. */
  small: string;
  /** Every resized version, for the browser to pick from by its width. */
  srcSet: string;
  /** A tiny version to show blurred while a real one loads, when the photo has one. */
  preview?: string | null;
  /** The 500 × 500 square picked for square tiles, when the photo has one. */
  thumbnail?: string | null;
  /** A tiny version of the thumbnail's square to show blurred while it loads, when there is one. */
  thumbnailPreview?: string | null;
}

/** The resized versions the pipeline makes, smallest first, with their longest edge in pixels. */
const VERSIONS = [
  ["xsmall", 250],
  ["small", 500],
  ["medium", 1200],
  ["large", 1800],
  ["xlarge", 2500],
] as const;

type Version = (typeof VERSIONS)[number][0];

/** The URLs of a photo's versions in R2, by name, as its JSON file saves them. */
export type PhotoImages = Partial<
  Record<Version | "preview" | "thumbnail" | "thumbnailpreview", string | null>
> & {
  /** The square the thumbnail was cut from, and its size; older entries don't have it. */
  thumbnailcrop?: { x: number; y: number; size: number; outputSize: number } | null;
};

/** The fields of a photo's JSON entry that its image is read from. */
interface ImageData {
  width: number | null;
  height: number | null;
  images: PhotoImages;
}

/** The resized versions' URLs with their widths: a version keeps the photo's size when it's already smaller. */
function resizedVersions({ width, height, images }: ImageData & { width: number; height: number }) {
  return VERSIONS.flatMap(([name, longestEdge]) => {
    const url = images[name];
    const scale = Math.min(1, longestEdge / Math.max(width, height));
    return url ? [{ url, longestEdge, width: Math.round(width * scale) }] : [];
  });
}

/** The Medium version, or the largest one below it, or else the smallest there is. */
function defaultSrc(versions: ReturnType<typeof resizedVersions>) {
  return (versions.findLast(({ longestEdge }) => longestEdge <= 1200) ?? versions[0])?.url;
}

/** The Small version, or the smallest one above it, or else the largest there is. */
function smallSrc(versions: ReturnType<typeof resizedVersions>, fallback: string) {
  return (
    (versions.find(({ longestEdge }) => longestEdge >= 500) ?? versions.at(-1))?.url ?? fallback
  );
}

/** The photo's resized versions as a view draws them; null for a photo without a size or any version. */
export function parseImage(photo: ImageData): PhotoImage | null {
  const { width, height } = photo;
  if (!width || !height) return null;
  const versions = resizedVersions({ ...photo, width, height });
  const src = defaultSrc(versions);
  if (!src) return null;
  const small = smallSrc(versions, src);
  const srcSet = versions.map((version) => `${version.url} ${version.width}w`).join(", ");
  const { preview, thumbnail, thumbnailpreview } = photo.images;
  return {
    width,
    height,
    src,
    small,
    srcSet,
    preview,
    thumbnail,
    thumbnailPreview: thumbnailpreview,
  };
}
