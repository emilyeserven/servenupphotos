import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { post, requestJson } from "@/api/request";
import type { FaceBox } from "@/lib/face-boxes";

/** The faces pixelated on, or found on, the photo at key in R2. */
interface FacesResponse {
  key: string;
  faces: FaceBox[];
}

/**
 * The faces pixelated on every version of the original at key in R2, as saved with its Square
 * Thumbnail; none when nothing was pixelated or there's no Square Thumbnail yet.
 */
export const savedFacesQuery = (key: string) =>
  queryOptions({
    queryKey: ["photos", "bucket", "faces", key],
    queryFn: async () =>
      (await requestJson<FacesResponse>(`/api/photos/bucket/faces?${new URLSearchParams({ key })}`))
        .faces,
    retry: false,
    staleTime: 0,
  });

/**
 * Looks for faces on the original at key in R2 and answers with a box for each, largest first, to
 * check and adjust before pixelating. Nothing is changed in R2.
 */
export const detectFacesMutation = mutationOptions({
  mutationKey: ["photos", "bucket", "faces", "detect"],
  mutationFn: async ({ key }: { key: string }) =>
    (await post<FacesResponse>("/api/photos/bucket/faces/detect", { key })).faces,
});
