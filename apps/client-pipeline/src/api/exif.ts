import { mutationOptions } from "@tanstack/react-query";

interface Color {
  hex: string;
  lab: { l: number; a: number; b: number };
  hcl: { h: number; c: number; l: number };
}

interface Swatch extends Color {
  /** Fraction (0–1) of sampled pixels closest to this color. */
  share: number;
}

export interface ColorAnalysis {
  average: Color;
  /** Up to 12 colors, largest share first. */
  palette: Swatch[];
  lightness: number;
  chroma: number;
  samples: number;
}

export interface ExifResponse {
  file: string;
  /** Null when exiftool is not available on the backend. */
  exif: Record<string, unknown> | null;
  colors: ColorAnalysis;
}

async function postPhoto(photo: File): Promise<ExifResponse> {
  const body = new FormData();
  body.append("photo", photo);

  const res = await fetch("/api/exif", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as (ExifResponse & { message?: string }) | null;
  if (!res.ok) throw new Error(json?.message ?? `/api/exif responded ${res.status}`);
  return json as ExifResponse;
}

export const exifMutation = mutationOptions({
  mutationKey: ["exif"],
  mutationFn: postPhoto,
});
