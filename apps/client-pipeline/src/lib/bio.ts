/** A self-portrait uploaded for the bio alone: not a photo file, so no other page shows it. */
export interface BioPortrait {
  /** The link in R2 of the version the bio shows, at most 1800px on its long edge. */
  image: string;
  /** The link in R2 of the version at most 500px on its long edge. */
  small: string;
  /** The size of `image`, in pixels. */
  width: number;
  height: number;
  /** The self-portrait's alt text, or "". */
  alt: string;
}

/** One photo on the bio: one of the portfolio's photos, by its file's path, or a self-portrait. */
export type BioPhoto =
  | { photo: string; portrait?: undefined }
  | { portrait: BioPortrait; photo?: undefined };

/** The bio file, `bio/bio.json`: the bio the portfolio will show, in Markdown, and its photos in order. */
export interface Bio {
  /** Always "bio": there's one bio. */
  id: "bio";
  /** The bio itself, in Markdown. */
  text: string;
  /** The bio's photos, in the order it shows them: portfolio photos and self-portraits, mixed. */
  photos: BioPhoto[];
}

/** The bio before anything is written. */
export const EMPTY_BIO: Bio = { id: "bio", text: "", photos: [] };

/** What tells a bio photo from the others: its file's path, or its self-portrait's link. */
export function bioPhotoKey(photo: BioPhoto): string {
  return photo.portrait ? photo.portrait.image : photo.photo;
}

/**
 * What a bio photo is called: its self-portrait's alt text, or "Self-portrait" without one; or the
 * portfolio photo's name, siteName, or its file's name when the page can't find it.
 */
export function bioPhotoName(photo: BioPhoto, siteName: string | undefined): string {
  if (photo.portrait) return photo.portrait.alt.trim() || "Self-portrait";
  return siteName ?? photo.photo.split("/").pop() ?? photo.photo;
}

/** The picture a bio photo's tile shows: its self-portrait's small version, or else siteImage. */
export function bioTileImage(photo: BioPhoto, siteImage: string | null | undefined) {
  return photo.portrait?.small ?? siteImage ?? undefined;
}

/** The paths of the portfolio photos on the bio. */
export function sitePhotosIn(bio: Bio): Set<string> {
  return new Set(bio.photos.flatMap((p) => (p.portrait ? [] : [p.photo])));
}

/** The bio with its text set to text. */
export function setText(bio: Bio, text: string): Bio {
  return { ...bio, text };
}

/** The bio with the portfolio photo at path added at the end; unchanged when it's there already. */
export function addSitePhoto(bio: Bio, path: string): Bio {
  if (sitePhotosIn(bio).has(path)) return bio;
  return { ...bio, photos: [...bio.photos, { photo: path }] };
}

/** The bio with an uploaded self-portrait added at the end. */
export function addPortrait(bio: Bio, portrait: BioPortrait): Bio {
  return { ...bio, photos: [...bio.photos, { portrait }] };
}

/** The bio without its photo at place. */
export function removeBioPhoto(bio: Bio, place: number): Bio {
  return { ...bio, photos: bio.photos.filter((_, i) => i !== place) };
}

/** The bio with its photo at from moved to to, the others keeping their order. */
export function moveBioPhoto(bio: Bio, from: number, to: number): Bio {
  const photo = bio.photos[from];
  if (!photo) return bio;
  return { ...bio, photos: bio.photos.toSpliced(from, 1).toSpliced(to, 0, photo) };
}

/** The bio with the alt text of the self-portrait at place set to alt. */
export function setPortraitAlt(bio: Bio, place: number, alt: string): Bio {
  const photos = bio.photos.map((p, i) =>
    i === place && p.portrait ? { portrait: { ...p.portrait, alt } } : p,
  );
  return { ...bio, photos };
}
