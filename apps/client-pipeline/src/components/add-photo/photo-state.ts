import type { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import type { ExifResponse, SanitizedExif } from "@/api/exif";
import { fileStem, type PhotoDetails } from "@/components/photo-details";

/** The mutation that analyzes the chosen photo on the Go backend. */
export type ExifMutation = UseMutationResult<ExifResponse, Error, File>;

/** State that belongs to the photo analyzed at `submittedAt`, so choosing another photo starts it over. */
export function usePhotoState<T>(submittedAt: number, initial: T): [T, (value: T) => void] {
  const [state, setState] = useState<{ submittedAt: number; value: T } | null>(null);
  const value = state?.submittedAt === submittedAt ? state.value : initial;
  return [value, (next) => setState({ submittedAt, value: next })];
}

/** What to call the analyzed photo in the tab: its title, or else its file name; null until it's analyzed. */
export function newPhotoName(extract: ExifMutation, details: PhotoDetails): string | null {
  if (!extract.isSuccess) return null;
  return details.title.trim() || fileStem(extract.data.file);
}

/** What ALLPHOTOS.json is checked for, once the photo's EXIF has been read. */
export function photoIdentity(extract: ExifMutation, sanitized: SanitizedExif | null) {
  if (!extract.isSuccess || !sanitized) return null;
  const { gpsPosition, createDate } = sanitized;
  return { file: extract.data.file, gpsPosition, createDate };
}
