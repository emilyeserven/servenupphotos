import { createFileRoute } from "@tanstack/react-router";
import { HeartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { LikedList, type LikedListService } from "@/components/liked-list";
import { LikedPhotos } from "@/components/liked-photos";
import { PhotoLightbox } from "@/components/photo-lightbox";
import type { ImagePhoto } from "@/components/photo-tiles";
import { SiteHomeLink } from "@/components/site-home-link";
import { useLikedIds } from "@/lib/likes";
import {
  parseShownPhoto,
  showablePhoto,
  type ShownPhotoSearch,
  useShownPhoto,
} from "@/lib/shown-photo";

interface LikesSearch extends ShownPhotoSearch {
  /** Set to `text` when the text to send is just the ids, for Messenger or a text message. Left out for Discord. */
  service?: "text";
}

/** Reads the message service and the open photo from the URL. */
function validateLikesSearch(search: Record<string, unknown>): LikesSearch {
  return {
    ...(search.service === "text" ? { service: "text" as const } : {}),
    ...parseShownPhoto(search),
  };
}

export const Route = createFileRoute("/likes")({
  validateSearch: validateLikesSearch,
  component: LikesPage,
});

/** The liked photos still in the portfolio, most recently liked first. */
function useLikedPhotos(): ImagePhoto[] {
  const ids = useLikedIds();
  return useMemo(() => ids.flatMap((id) => showablePhoto(id) ?? []), [ids]);
}

/**
 * The value, except while held, when it stays what it was when holding began. My Likes holds its
 * photos while the viewer is open, so unliking the open photo doesn't pull it out from under the
 * previous and next buttons.
 */
function useHeld<T>(value: T, held: boolean): T {
  const [kept, setKept] = useState(value);
  if (!held && kept !== value) setKept(value);
  return held ? kept : value;
}

/**
 * The photos this browser liked, kept in its local storage, each with the visitor's own comment,
 * and a list of their titles to copy.
 */
function LikesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { shown, show, close } = useShownPhoto();
  const liked = useHeld(useLikedPhotos(), shown !== null);
  return (
    <div className="flex w-full flex-col gap-6 px-3 py-16 sm:px-4">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-4 gap-y-1 px-1 sm:px-2">
        <SiteHomeLink className="basis-full" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <HeartIcon className="size-8 text-muted-foreground" aria-hidden />
          My Likes
        </h1>
        <p className="text-sm text-muted-foreground">
          {liked.length} {liked.length === 1 ? "photo" : "photos"}, saved in this browser
        </p>
      </header>
      <div className="mx-auto w-full max-w-6xl px-1 sm:px-2">
        {liked.length === 0 ? (
          <NoLikes />
        ) : (
          <LikedList
            photos={liked}
            service={search.service ?? "discord"}
            onService={(service) =>
              void navigate({ search: serviceSearch(service), replace: true })
            }
          />
        )}
      </div>
      <div className="mx-auto w-full max-w-6xl px-1 sm:px-2">
        <LikedPhotos photos={liked} onOpen={show} />
      </div>
      <PhotoLightbox photo={shown} photos={liked} onShow={show} onClose={close} />
    </div>
  );
}

/** The service as the URL keeps it, leaving out Discord, the default. */
function serviceSearch(service: LikedListService) {
  return (prev: LikesSearch): LikesSearch => ({
    ...prev,
    service: service === "text" ? "text" : undefined,
  });
}

/** What My Likes says before anything is liked: how to like a photo. */
function NoLikes() {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      No likes yet. Open any photo and double tap it, or press its{" "}
      <HeartIcon className="inline size-4 align-text-bottom" aria-label="heart" /> button, to keep
      it here.
    </p>
  );
}
