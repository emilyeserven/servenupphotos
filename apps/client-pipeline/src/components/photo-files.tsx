import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useCallback, useMemo } from "react";
import {
  type SocialCalendar,
  type SocialCalendarRead,
  type SocialPhoto,
  socialCalendarQuery,
} from "@/api/publish";
import { QueryResult } from "@/components/query-result";
import { withBaseAllPhotos } from "@/lib/combined";
import { withoutUndecided } from "@/lib/social-schedule";
import { useChangedPhotoFiles, useCombinedData } from "@/stores/combined-data";

/**
 * Reads every photo file, as the Publish pages pick from them, and shows children with them once
 * they're read. ALLPHOTOS.json on the base branch, kept by the combined data store, tells photos in
 * flight from published ones.
 */
export function PhotoFiles({
  children,
  query = socialCalendarQuery,
}: {
  children: (files: SocialCalendar) => ReactNode;
  /** The read of the photo files to use; the Instagram calendar's whole files by default. */
  query?: typeof socialCalendarQuery;
}) {
  const combined = useCombinedData();
  const { data: lists, error } = combined;
  const select = useCallback(
    (read: SocialCalendarRead) => withBaseAllPhotos(read, { data: lists, error }),
    [lists, error],
  );
  const files = useQuery({ ...query, select });
  if (combined.isPending) return <p>Reading ALLPHOTOS.json…</p>;
  return (
    <QueryResult query={files} pendingLabel="Reading the photo JSON…">
      {children}
    </QueryResult>
  );
}

/**
 * Reads every photo file, as PhotoFiles does, and shows children with all of them but those set
 * aside as Undecided, the photos a page such as the Photo Book or the Bio can use.
 */
export function DecidedPhotoFiles({
  children,
}: {
  children: (photos: SocialPhoto[]) => ReactNode;
}) {
  return <PhotoFiles>{(calendar) => <Decided calendar={calendar}>{children}</Decided>}</PhotoFiles>;
}

function Decided(props: {
  calendar: SocialCalendar;
  children: (photos: SocialPhoto[]) => ReactNode;
}) {
  const { calendar, children } = props;
  const changed = useChangedPhotoFiles();
  const { photos } = useMemo(
    () => withoutUndecided(calendar.photos, changed),
    [calendar.photos, changed],
  );
  return children(photos);
}
