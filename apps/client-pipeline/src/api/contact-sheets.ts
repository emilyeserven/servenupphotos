import { mutationOptions } from "@tanstack/react-query";
import { post, requestJson } from "@/api/request";

/** One photo to put on a contact sheet: the name the prompt calls it by, and its image. */
export interface ContactSheetPhoto {
  /** The name drawn under its tile, such as `20161216_092741`. */
  label: string;
  /** Its image, best its Small version, which the backend keeps offline. */
  url: string;
}

/** One contact sheet in R2 and the numbers of the tiles on it. */
export interface ContactSheet {
  /** The sheet's public link in R2, which works for about a day. */
  url: string;
  /** The numbers of its first and last tiles, counted from 1 across every sheet. */
  first: number;
  last: number;
}

/** The contact sheets made for a prompt's photos. */
export interface ContactSheets {
  sheets: ContactSheet[];
  /** The names of the photos that couldn't be read, drawn as gray tiles so the numbers still match. */
  missing: string[];
  /** Why R2 couldn't be set to delete the sheets after a day, with how to set it by hand; "" when it's set. */
  expiryProblem: string;
}

/**
 * Draws the photos, in the order the prompt lists them, as numbered contact sheets of 30 and puts
 * them in R2's `contact-sheets/` folder, which R2 empties after a day. Saves nothing for Commit.
 */
export const contactSheetsMutation = mutationOptions({
  mutationKey: ["photos", "bucket", "contact-sheets"],
  mutationFn: (body: { photos: ContactSheetPhoto[] }) =>
    post<ContactSheets>("/api/photos/bucket/contact-sheets", body),
});

/** What deleting contact sheets did: how many went, and the ones that stayed, with why. */
interface DeletedContactSheets {
  deleted: number;
  failed: { key: string; message: string }[];
}

/**
 * Deletes one set of contact sheets from R2 by its folder's name, such as
 * `20261115-045000-1a2b3c4d`, or every set for "".
 */
export const deleteContactSheetsMutation = mutationOptions({
  mutationKey: ["photos", "bucket", "contact-sheets", "delete"],
  mutationFn: (set: string) =>
    requestJson<DeletedContactSheets>("/api/photos/bucket/contact-sheets", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ set }),
    }),
});
