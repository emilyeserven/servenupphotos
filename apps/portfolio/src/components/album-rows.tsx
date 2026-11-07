import type { CSSProperties } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { FittedPhoto } from "@/components/fitted-photo";
import { cn } from "@/lib/utils";
import type { ShownRow } from "@/lib/album-layout";
import type { ImagePhoto } from "@/lib/spotlight-zones";

/** Markdown's headings, lists, links, code and quotes, which Tailwind's reset strips, sized for reading. */
const PROSE =
  "break-words leading-relaxed [&>*+*]:mt-3 [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1,&_h2,&_h3]:font-semibold [&_h1,&_h2,&_h3]:tracking-tight [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5 [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_hr]:my-6";

/** Keeps each line break written, not only blank lines between paragraphs. */
const MARKDOWN_PLUGINS = [remarkBreaks];

/** The text's column, lined up with the album's name, its lines kept short enough to read. */
const NARROW = "mx-auto w-full max-w-5xl px-4 sm:px-6 [&>*]:max-w-2xl";

/** Markdown text written for the album or a Trip page, in the text's column; nothing for "". */
export function AlbumText({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className={`${NARROW} ${PROSE}`}>
      <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{text}</Markdown>
    </div>
  );
}

/** Each row of the album's layout: its text above, its photos side by side, and its text below. */
export function AlbumRows({
  rows,
  onOpen,
}: {
  rows: ShownRow[];
  onOpen: (photo: ImagePhoto) => void;
}) {
  return (
    <ol className="flex flex-col gap-10">
      {rows.map((row, i) => (
        <li key={i} className="flex flex-col gap-4">
          <AlbumText text={row.textAbove} />
          <RowPhotos photos={row.photos} onOpen={onOpen} />
          <AlbumText text={row.textBelow} />
        </li>
      ))}
    </ol>
  );
}

/** A photo's own text on a Trip page, and where it goes: under it as a caption, or beside it. */
export interface PhotoText {
  text: string;
  side: "caption" | "left" | "right";
}

/** The photo's text when it goes on side; nothing otherwise. */
function textOn(text: PhotoText | undefined, side: PhotoText["side"]): string {
  return text?.side === side ? text.text : "";
}

/** A photo's caption, small and muted under it, in Markdown; nothing for none. */
function Caption({ text }: { text?: PhotoText }) {
  const caption = textOn(text, "caption");
  if (!caption) return null;
  return (
    <figcaption className={`mt-1.5 px-1 text-sm text-muted-foreground ${PROSE}`}>
      <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{caption}</Markdown>
    </figcaption>
  );
}

/** A photo's text as a paragraph beside it, in Markdown, when it goes on side; nothing otherwise. */
function SideText({
  text,
  side,
  wide,
}: {
  text?: PhotoText;
  side: "left" | "right";
  wide?: boolean;
}) {
  const paragraph = textOn(text, side);
  if (!paragraph) return null;
  return (
    <div className={cn("shrink-0 px-1", wide ? "sm:w-80" : "sm:w-40 text-sm", PROSE)}>
      <Markdown remarkPlugins={MARKDOWN_PLUGINS}>{paragraph}</Markdown>
    </div>
  );
}

/** Whether the photo's text is a paragraph beside it. */
function isBeside(text: PhotoText | undefined): boolean {
  return text !== undefined && text.text !== "" && text.side !== "caption";
}

/**
 * A photo on its own, as large as it fits, with its text under it as a caption, or beside it as a
 * paragraph (above or below it on a phone).
 */
function OnlyPhoto({
  photo,
  text,
  onOpen,
}: {
  photo: ImagePhoto;
  text?: PhotoText;
  onOpen: () => void;
}) {
  return (
    <figure
      className={cn(
        "flex flex-col items-center gap-4",
        isBeside(text) && "mx-auto w-full max-w-7xl px-4 sm:flex-row sm:gap-8 sm:px-6",
      )}
    >
      <SideText text={text} side="left" wide />
      <div className="w-full min-w-0 flex-1">
        <FittedPhoto photo={photo} onOpen={onOpen} />
      </div>
      <SideText text={text} side="right" wide />
      <Caption text={text} />
    </figure>
  );
}

/**
 * A row's photos: one on its own as large as it fits, or several side by side at the same height,
 * each as wide as its shape makes it, filling the width without being taller than the screen. On a
 * phone they go one under another. A photo with text (a Trip page's) has it under it as a caption,
 * or beside it as a paragraph.
 */
export function RowPhotos({
  photos,
  onOpen,
  texts,
}: {
  photos: ImagePhoto[];
  onOpen: (photo: ImagePhoto) => void;
  /** Each photo's text, by its ID. */
  texts?: ReadonlyMap<number, PhotoText>;
}) {
  if (photos.length === 0) return null;
  const [only] = photos;
  if (photos.length === 1 && only) {
    return <OnlyPhoto photo={only} text={texts?.get(only.id)} onOpen={() => onOpen(only)} />;
  }
  // The row's width over its height, the sum of its photos'.
  const shape = photos.reduce((sum, photo) => sum + photo.image.width / photo.image.height, 0);
  return (
    <div
      className="mx-auto flex w-full flex-col gap-2 px-2 sm:max-w-[calc(100svh*var(--shape))] sm:flex-row sm:gap-3 sm:px-3"
      style={{ "--shape": shape } as CSSProperties}
    >
      {photos.map((photo) => (
        <RowPhoto
          key={photo.id}
          photo={photo}
          text={texts?.get(photo.id)}
          onOpen={() => onOpen(photo)}
        />
      ))}
    </div>
  );
}

/**
 * A photo in a row, growing to its share of the row's width by its shape, with its caption under
 * it or its paragraph beside it.
 */
function RowPhoto({
  photo,
  text,
  onOpen,
}: {
  photo: ImagePhoto;
  text?: PhotoText;
  onOpen: () => void;
}) {
  const { width, height, src, srcSet } = photo.image;
  return (
    <figure
      className="min-w-0 sm:[flex:var(--photo-shape)_1_0%]"
      style={{ "--photo-shape": width / height } as CSSProperties}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <SideText text={text} side="left" />
        <button
          type="button"
          title={photo.title}
          onClick={onOpen}
          className="block w-full min-w-0 cursor-zoom-in overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <img
            src={src}
            srcSet={srcSet}
            sizes="(min-width: 640px) 50vw, 100vw"
            alt={photo.alt}
            loading="lazy"
            className="size-full object-cover"
          />
        </button>
        <SideText text={text} side="right" />
      </div>
      <Caption text={text} />
    </figure>
  );
}
