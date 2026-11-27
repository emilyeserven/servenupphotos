import { useMemo } from "react";
import type { CaptionTemplate } from "@/api/captions";
import type { CombinedData } from "@/api/photos";
import type { SocialPhoto } from "@/api/publish";
import { bookAlbums } from "@/components/photo-book/album-photos";
import { BookSettings, DeleteBookButton } from "@/components/photo-book/book-bar";
import { BudgetFields } from "@/components/photo-book/budget-fields";
import { CameraNamesField } from "@/components/photo-book/camera-names-field";
import { CaptionTitlesField } from "@/components/photo-book/caption-titles-field";
import { LensPrefixesField } from "@/components/photo-book/lens-prefixes-field";
import { RefreshCaptions } from "@/components/photo-book/refresh-captions";
import { SizeFields } from "@/components/photo-book/size-fields";
import { TitlesField } from "@/components/photo-book/titles-field";
import type { PhotoBook } from "@/lib/photo-book";

interface InfoTabProps {
  book: PhotoBook;
  update: (book: PhotoBook) => void;
  data: CombinedData;
  /** Every photo, for the cameras and lenses of the ones on the book's pages. */
  photos: SocialPhoto[];
  templates: CaptionTemplate[];
  /** The template the captions are filled in with now. */
  template: CaptionTemplate | undefined;
  onRemoved: () => void;
}

/**
 * A book's Info tab: its name, the album its photos come from, its caption template and Refresh all
 * captions, whether its captions have titles, its camera and lens names, its page size, its page budget, whether its pages show
 * titles, and Remove book.
 */
export function InfoTab(props: InfoTabProps) {
  const { book, update, data, photos, templates, template, onRemoved } = props;
  const albums = useMemo(() => bookAlbums(data), [data]);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BookSettings
        book={book}
        albums={albums}
        templates={templates}
        template={template}
        onChange={update}
      />
      <RefreshCaptions book={book} onChange={update} />
      <CaptionTitlesField book={book} onChange={update} />
      <CameraNamesField book={book} photos={photos} onChange={update} />
      <LensPrefixesField book={book} photos={photos} onChange={update} />
      <SizeFields book={book} onChange={update} />
      <BudgetFields book={book} onChange={update} />
      <TitlesField book={book} onChange={update} />
      <div>
        <DeleteBookButton book={book} onDeleted={onRemoved} />
      </div>
    </div>
  );
}
