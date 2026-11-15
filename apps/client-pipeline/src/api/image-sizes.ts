import { mutationOptions } from "@tanstack/react-query";
import { post } from "@/api/request";

/** One Small version's size in pixels, or why it couldn't be read. */
export interface MeasuredImage {
  url: string;
  /** Its width and height, 0 when `error` says why it couldn't be read. */
  width: number;
  height: number;
  error?: string;
}

/** The sizes of the Small versions asked about, in the order they were asked. */
interface ImageSizes {
  images: MeasuredImage[];
}

/**
 * Measures Small versions in R2, reading each from the backend's offline copy (downloading it
 * first when it isn't kept yet), for the Quality Check's aspect ratio check. Saves nothing.
 */
export const imageSizesMutation = mutationOptions({
  mutationKey: ["photos", "bucket", "sizes"],
  mutationFn: (body: { urls: string[] }) => post<ImageSizes>("/api/photos/bucket/sizes", body),
});
