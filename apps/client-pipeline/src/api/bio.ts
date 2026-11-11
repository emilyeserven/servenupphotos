import { mutationOptions } from "@tanstack/react-query";
import { settingEntries, settingMutations } from "@/api/data-files";
import type { CombinedData } from "@/api/photos";
import { requestJson } from "@/api/request";
import { type Bio, type BioPortrait, EMPTY_BIO } from "@/lib/bio";

function isBio(value: unknown): value is Bio {
  const bio = value as Partial<Bio> | null;
  return bio?.id === "bio" && typeof bio.text === "string" && Array.isArray(bio.photos);
}

const bioEntries = settingEntries("bio", isBio);

/** The bio as the next Commit will have it: BIO.json with the changes since, or an empty one. */
export function bioFile(data: CombinedData | undefined): Bio {
  return bioEntries(data)[0] ?? EMPTY_BIO;
}

/** Saves the bio, its text and its photos in order, as a change waiting for Commit. */
export const saveBioMutation = settingMutations<Bio>("bio").save;

/** Where an uploaded self-portrait's two versions went in R2, and the large one's size. */
type UploadedPortrait = Omit<BioPortrait, "alt">;

/** Puts a self-portrait in R2 right away, as its two WEBP versions, for the bio to point at. */
export const uploadBioPortraitMutation = mutationOptions({
  mutationKey: ["bio", "portrait"],
  mutationFn: (image: File) => {
    const body = new FormData();
    body.append("image", image);
    return requestJson<UploadedPortrait>("/api/bio/portrait", { method: "POST", body });
  },
});
