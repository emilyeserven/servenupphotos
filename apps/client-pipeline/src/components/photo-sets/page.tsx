import { useNavigate, useSearch } from "@tanstack/react-router";
import type { PhotoSet } from "@portfolio/lib/photo-sets";
import { photoSetFiles } from "@/api/photo-sets";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { DecidedPhotoFiles } from "@/components/photo-files";
import { SetChooser } from "@/components/photo-sets/set-chooser";
import { SetEditor } from "@/components/photo-sets/set-editor";
import type { SocialPhoto } from "@/api/publish";
import { useCombinedData } from "@/stores/combined-data";

/**
 * The Photo Sets page, under Organize: photos the portfolio's map always keeps together as one
 * marker, made and edited one set at a time.
 */
export function PhotoSetsPage() {
  return (
    <Page
      wide
      title="Photo Sets"
      description="Photos the portfolio's map always shows as one marker, a photo with another stacked behind it, however far in or out it's zoomed; clicking it opens the set's photos. A photo can be in one set. Each set is one JSON file, combined into SETS.json."
    >
      <GitHubGate>
        {() => <DecidedPhotoFiles>{(photos) => <Sets photos={photos} />}</DecidedPhotoFiles>}
      </GitHubGate>
    </Page>
  );
}

/** The set chosen in the address (`?set=`), or else the first one. */
function useChosenSet(sets: PhotoSet[]) {
  const search = useSearch({ strict: false }) as { set?: string };
  const navigate = useNavigate();
  const chosen = sets.find((set) => set.id === search.set) ?? sets[0];
  const choose = (id: string | undefined) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, set: id }),
      resetScroll: false,
    });
  return { chosen, choose };
}

function Sets({ photos }: { photos: SocialPhoto[] }) {
  const { data, isPending } = useCombinedData();
  const sets = photoSetFiles(data);
  const { chosen, choose } = useChosenSet(sets);
  if (isPending) return <p>Reading the Photo Sets…</p>;
  return (
    <div className="flex flex-col gap-4">
      <SetChooser
        key={sets.length === 0 ? "none" : "some"}
        sets={sets}
        chosen={chosen}
        onChoose={choose}
      />
      {chosen && <SetEditor key={chosen.id} saved={chosen} sets={sets} photos={photos} />}
    </div>
  );
}
