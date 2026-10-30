import { useMutation } from "@tanstack/react-query";
import { CloudDownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CombinedPhoto } from "@/lib/group-photos";
import { offlineXSmallUrl } from "@/lib/offline-thumbnails";

/** How many X-Small versions are asked for at once. */
const AT_ONCE = 4;

/** How many of the urls the offline copy now has, asking for AT_ONCE at a time. */
async function keepOffline(urls: string[]): Promise<{ kept: number; failed: number }> {
  let kept = 0;
  for (let i = 0; i < urls.length; i += AT_ONCE) {
    const answers = await Promise.all(
      urls.slice(i, i + AT_ONCE).map((url) =>
        fetch(url).then(
          (r) => r.ok,
          () => false,
        ),
      ),
    );
    kept += answers.filter(Boolean).length;
  }
  return { kept, failed: urls.length - kept };
}

/**
 * A button that has the backend keep the X-Small version of every photo the album's layout can
 * use in its offline copy, so the preview shows them without the internet, and says how it went.
 */
export function OfflinePreviewsButton({ photos }: { photos: CombinedPhoto[] }) {
  const urls = photos.flatMap((photo) => offlineXSmallUrl(photo) ?? []);
  const keep = useMutation({ mutationFn: () => keepOffline(urls) });
  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        size="xs"
        variant="outline"
        disabled={urls.length === 0 || keep.isPending}
        title="Download small versions of the album's photos so the preview works offline"
        onClick={() => keep.mutate()}
      >
        {keep.isPending ? <Spinner /> : <CloudDownloadIcon aria-hidden />}
        Keep offline
      </Button>
      <KeepOutcome result={keep.data} />
    </div>
  );
}

function KeepOutcome({ result }: { result?: { kept: number; failed: number } }) {
  if (!result) return null;
  if (result.failed === 0)
    return <p className="text-muted-foreground text-[0.625rem]">{result.kept} kept offline</p>;
  return (
    <p className="text-destructive text-[0.625rem]">
      {result.kept} kept, {result.failed} couldn't be downloaded
    </p>
  );
}
