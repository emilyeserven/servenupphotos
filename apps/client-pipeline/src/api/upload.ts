import { mutationOptions } from "@tanstack/react-query";

/** Where an uploaded photo ended up in R2. */
export interface UploadResponse {
  key: string;
  url: string;
}

async function uploadPhoto(photo: File): Promise<UploadResponse> {
  const body = new FormData();
  body.append("photo", photo);

  const res = await fetch("/api/upload", { method: "POST", body });
  const json = (await res.json().catch(() => null)) as
    | (UploadResponse & { message?: string })
    | null;
  if (!res.ok) throw new Error(json?.message ?? `/api/upload responded ${res.status}`);
  return json as UploadResponse;
}

export const uploadMutation = mutationOptions({
  mutationKey: ["upload"],
  mutationFn: uploadPhoto,
});
