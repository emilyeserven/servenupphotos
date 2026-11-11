import { useMemo, useState } from "react";
import { bioFile, saveBioMutation } from "@/api/bio";
import type { SocialPhoto } from "@/api/publish";
import { MarkdownField } from "@/components/album-layout/markdown-field";
import { BIO_PHOTO_DRAG_TYPE, type BioPhotoActions, BioPhotos } from "@/components/bio/bio-photos";
import { PortraitUpload } from "@/components/bio/portrait-upload";
import { PhotoDrawerToggle } from "@/components/instagram-picker/photo-drawer";
import { PhotoDrawerPanel } from "@/components/photo-drawer-panel";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { SaveState } from "@/components/save-state";
import { useDelayedDraft } from "@/hooks/use-delayed-draft";
import {
  type Bio,
  addPortrait,
  addSitePhoto,
  moveBioPhoto,
  removeBioPhoto,
  setPortraitAlt,
  setText,
  sitePhotosIn,
} from "@/lib/bio";
import { useCombinedData } from "@/stores/combined-data";

/** What the photo drawer says beside the bio. */
const BIO_DRAWER_WORDS = {
  help: "Drag a photo onto the bio's photos, or click it to add it at the end.",
  showUsed: "Show photos already on the bio",
  usedBadge: "On bio",
};

/** The Bio page's content: the bio, once the photo files are read. */
export function BioEditorPage() {
  return <DecidedPhotoFiles>{(photos) => <SavedBio photos={photos} />}</DecidedPhotoFiles>;
}

/** The bio as the next Commit will have it, once the combined lists are read. */
function SavedBio({ photos }: { photos: SocialPhoto[] }) {
  const { data, isPending } = useCombinedData();
  if (isPending) return <p>Reading the bio…</p>;
  return <BioEditor saved={bioFile(data)} photos={photos} />;
}

/** What the bio's photos do to bio, through update. */
function photoActions(bio: Bio, update: (b: Bio) => void): BioPhotoActions {
  return {
    onMove: (from, to) => update(moveBioPhoto(bio, from, to)),
    onRemove: (place) => update(removeBioPhoto(bio, place)),
    onAlt: (place, alt) => update(setPortraitAlt(bio, place, alt)),
    onAdd: (path) => update(addSitePhoto(bio, path)),
  };
}

/** The bio's text and photos, and the photo drawer beside them. */
function BioEditor({ saved, photos }: { saved: Bio; photos: SocialPhoto[] }) {
  const { value: bio, update, change, error, saving } = useDelayedDraft(saved, saveBioMutation);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const byPath = useMemo(() => new Map(photos.map((p) => [p.path, p])), [photos]);
  const onSite = useMemo(() => sitePhotosIn(bio), [bio]);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SaveState saving={saving} error={error} />
          <PhotoDrawerToggle open={drawerOpen} onToggle={() => setDrawerOpen(!drawerOpen)} />
        </div>
        <MarkdownField
          label="Bio"
          value={bio.text}
          onChange={(text) => update(setText(bio, text))}
          boxClassName="min-h-56"
        />
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-semibold">Photos</h2>
              <p className="text-muted-foreground text-sm">
                Drag the photos into the order the bio shows them, or move one with its arrows.
                Self-portraits are only on the bio; portfolio photos stay where they are on the rest
                of the site too.
              </p>
            </div>
            <PortraitUpload
              onUploaded={(portrait) => change((current) => addPortrait(current, portrait))}
            />
          </div>
          <BioPhotos photos={bio.photos} byPath={byPath} actions={photoActions(bio, update)} />
        </section>
      </div>
      {drawerOpen && (
        <PhotoDrawerPanel
          photos={photos}
          used={onSite}
          onPick={(photo) => update(addSitePhoto(bio, photo.path))}
          onClose={() => setDrawerOpen(false)}
          dragType={BIO_PHOTO_DRAG_TYPE}
          words={BIO_DRAWER_WORDS}
        />
      )}
    </div>
  );
}
