import type { ReactNode } from "react";
import { CustomBody } from "@/components/photo-book/custom-body";
import { GeneratedBody } from "@/components/photo-book/generated-body";
import { PhotoSlot } from "@/components/photo-book/page-slot";
import { type BookPageProps, type PageParts, pageName } from "@/components/photo-book/page-types";
import { SlotCaption } from "@/components/photo-book/slot-caption";
import { TextBody } from "@/components/photo-book/text-body";
import type { BuiltInLayout } from "@/lib/photo-book";
import { isGeneratedPage } from "@/lib/photo-book-generated";
import { customPageLook } from "@/lib/photo-book-layouts";
import { cn } from "@/lib/utils";

type BodyProps = Pick<
  BookPageProps,
  | "page"
  | "index"
  | "number"
  | "repeated"
  | "photos"
  | "captionFor"
  | "actions"
  | "layouts"
  | "sides"
  | "side"
  | "printWidth"
  | "noTitles"
  | "placesIndexFor"
>;

/** The other pages in the book with the slot's photo; none for a page left out. */
function alsoOn(photo: string, number: number | null, repeated: Map<string, number[]>): number[] {
  if (number === null) return [];
  return (repeated.get(photo) ?? []).filter((n) => n !== number);
}

/** The page's photo places and captions, each wired to the page's actions. */
function pageParts(props: BodyProps): PageParts {
  const { page, index, number, repeated, photos, captionFor, actions, printWidth } = props;
  return {
    title:
      page.title === null || (props.noTitles && page.layout !== "text") ? null : (
        <input
          aria-label={`${pageName(page)} title`}
          value={page.title}
          placeholder="TITLE"
          onChange={(event) => actions.onTitle(event.target.value)}
          className="w-full shrink-0 rounded-sm bg-transparent text-[4.4cqw] leading-none font-bold uppercase outline-none placeholder:text-neutral-600 hover:bg-white/10 in-data-[print]:placeholder:text-transparent focus:bg-white/10"
        />
      ),
    slot: (i, shape, className) => {
      const s = page.slots[i];
      if (!s) return null;
      return (
        <PhotoSlot
          key={`photo-${i}`}
          slot={s}
          place={{ page: index, slot: i }}
          print={{ page: page.id, inches: printWidth }}
          shape={shape}
          alsoOn={alsoOn(s.photo, number, repeated)}
          photo={photos.get(s.photo)}
          onDrop={(path, from) => actions.onDropPhoto(i, path, from)}
          onRemove={() => actions.onRemovePhoto(i)}
          className={className}
        />
      );
    },
    caption: (i, className) => {
      const s = page.slots[i];
      if (!s) return null;
      return (
        <SlotCaption
          key={`caption-${i}`}
          slot={s}
          text={captionFor(s)}
          onChange={(text) => actions.onCaption(i, text)}
          place={`${page.id}:${i}`}
          className={className}
        />
      );
    },
  };
}

/** The photos and the captions side by side, the photos taking the larger share on their side. */
function Sides(props: {
  left: boolean;
  photos: ReactNode;
  captions: ReactNode;
  className?: string;
}) {
  const { left, photos, captions, className } = props;
  return (
    <div
      className={cn(
        "grid min-h-0 gap-[3%]",
        left ? "grid-cols-[63fr_37fr]" : "grid-cols-[37fr_63fr]",
        className,
      )}
    >
      {left ? photos : captions}
      {left ? captions : photos}
    </div>
  );
}

/** One landscape photo over the page, its title above it and its caption under it. */
function FullBody({ parts }: { parts: PageParts }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3%]">
      {parts.title}
      {parts.slot(0, "landscape", "flex-1")}
      {parts.caption(0, "h-[18%] shrink-0 items-center")}
    </div>
  );
}

/**
 * One row of three columns: an info column with the page's title and both captions, in the photos'
 * order, then the two portrait photos; mirrored, the photos come first and the info column last.
 */
function VerticalsBody({ parts, left }: { parts: PageParts; left: boolean }) {
  const info = (
    <div key="info" className="flex min-h-0 flex-col justify-center gap-[6%]">
      {parts.title}
      {parts.caption(0)}
      {parts.caption(1)}
    </div>
  );
  const photos = [parts.slot(0, "portrait"), parts.slot(1, "portrait")];
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 gap-[2%]",
        left ? "grid-cols-[37fr_37fr_26fr]" : "grid-cols-[26fr_37fr_37fr]",
      )}
    >
      {left ? [...photos, info] : [info, ...photos]}
    </div>
  );
}

/**
 * Two landscape photos down one side, each caption beside its own photo, toward the gap between
 * them: the top one low beside its photo, under the page's title, the bottom one at its photo's
 * top, as the printed books have them.
 */
function PairBody({ parts, left }: { parts: PageParts; left: boolean }) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-[2%]">
      {[0, 1].map((i) => (
        <Sides
          key={i}
          left={left}
          photos={parts.slot(i, "landscape")}
          captions={
            i === 0 ? (
              <div className="flex min-h-0 flex-col">
                {parts.title}
                {parts.caption(0, "flex-1 justify-end pb-[12%]")}
              </div>
            ) : (
              parts.caption(1)
            )
          }
        />
      ))}
    </div>
  );
}

/** One of the book's other pages, such as a bio page: only its name, as a placeholder for now. */
function OtherBody({ name }: { name: string }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed border-neutral-700 p-[6%] in-data-[print]:border-transparent text-center text-[4cqw] leading-tight font-bold text-neutral-400 uppercase">
      {name}
    </div>
  );
}

/** How each photo layout draws the page's parts. */
const BODIES: Record<BuiltInLayout, (parts: PageParts) => ReactNode> = {
  full: (parts) => <FullBody parts={parts} />,
  "pair-left": (parts) => <PairBody parts={parts} left />,
  "pair-right": (parts) => <PairBody parts={parts} left={false} />,
  "verticals-left": (parts) => <VerticalsBody parts={parts} left />,
  "verticals-right": (parts) => <VerticalsBody parts={parts} left={false} />,
};

/** A photo page's photos and captions, laid out as its layout, built in or the book's own, says. */
function PhotosBody(props: BodyProps & { parts: PageParts }) {
  const { parts } = props;
  const custom = customPageLook(props.layouts, props.page, props.sides, props.side);
  if (custom) return <CustomBody parts={parts} look={custom} />;
  return (BODIES[props.page.layout as BuiltInLayout] ?? BODIES.full)(parts);
}

/** The page's photos and captions, laid out as its layout says; a text page's text too, and a generated page's contents. */
export function PageBody(props: BodyProps) {
  const { layout } = props.page;
  if (isGeneratedPage(props.page)) {
    return <GeneratedBody page={props.page} placesIndexFor={props.placesIndexFor} />;
  }
  if (layout === "other") return <OtherBody name={pageName(props.page)} />;
  const parts = pageParts(props);
  if (layout !== "text") return <PhotosBody {...props} parts={parts} />;
  return <TextBody parts={parts} page={props.page} actions={props.actions} />;
}
