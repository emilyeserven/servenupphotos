import dummyData from "@/data/dummy.json";

export interface Photo {
  id: number;
  title: string;
  camera: string;
  takenAt: Date;
  location: string;
  /** Null when the photo has no GPS position, so it can't go on the map. */
  latitude: number | null;
  longitude: number | null;
}

/** One entry of ALLPHOTOS.json: a photo's file name and sanitized EXIF, as the pipeline saves it. */
interface PhotoData {
  file: string;
  camera: string | null;
  gpsPosition: string | null;
  createDate: string | null;
  country: string | null;
  city: string | null;
}

// ALLPHOTOS.local.json is made by `pnpm photos:local` (and `pnpm dev:docker`) and git-ignored, so
// it's only there locally. A glob, unlike an import, doesn't fail when the file is missing.
const localData = Object.values(
  import.meta.glob<PhotoData[]>("../data/ALLPHOTOS.local.json", { eager: true, import: "default" }),
)[0];

/** Exiftool's "2026:05:16 15:24:10" (sometimes with a time zone after it), as local time. */
function parseCreateDate(value: string | null): Date | null {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  // An ISO date and time without a time zone is read as local time.
  const [, year, month, day, time] = match;
  return new Date(`${year}-${month}-${day}T${time}`);
}

/**
 * One coordinate of exiftool's `37 deg 31' 21.06" N, 126 deg 58' 46.24" E`, in decimal degrees.
 * `hemispheres` lists the positive hemisphere first: "NS" for latitude, "EW" for longitude.
 */
function parseCoordinate(value: string, hemispheres: "NS" | "EW"): number | null {
  const number = String.raw`(\d+(?:\.\d+)?)`;
  const match = value.match(new RegExp(`${number} deg ${number}' ${number}" ([${hemispheres}])`));
  if (!match) return null;
  const [, deg, min, sec, hemisphere] = match;
  const degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return hemisphere === hemispheres[0] ? degrees : -degrees;
}

function parseGpsPosition(value: string | null) {
  const [lat = "", lng = ""] = value?.split(",") ?? [];
  const latitude = parseCoordinate(lat, "NS");
  const longitude = parseCoordinate(lng, "EW");
  return latitude === null || longitude === null
    ? { latitude: null, longitude: null }
    : { latitude, longitude };
}

/** The local ALLPHOTOS.json entries the portfolio can place in time; ones without a date are left out. */
function fromPhotoData(data: PhotoData[]): Photo[] {
  return data.flatMap((photo, index) => {
    const takenAt = parseCreateDate(photo.createDate);
    if (!takenAt) return [];
    return {
      id: index + 1,
      title: photo.file.replace(/\.[^.]*$/, ""),
      camera: photo.camera ?? "Unknown camera",
      takenAt,
      location: [photo.city, photo.country].filter(Boolean).join(", ") || "Unknown location",
      ...parseGpsPosition(photo.gpsPosition),
    };
  });
}

// Dummy data until real photos are wired up for the deployed site: about two years of shoot days,
// each with a handful of photos taken around one city.
const dummyPhotos: Photo[] = dummyData.map((photo) => ({
  ...photo,
  takenAt: new Date(photo.takenAt),
}));

const localPhotos = localData ? fromPhotoData(localData) : [];

/** The photos in ALLPHOTOS.local.json when there are any, or else the dummy data. */
export const photos: Photo[] = localPhotos.length > 0 ? localPhotos : dummyPhotos;
