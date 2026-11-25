import type { ReactNode } from "react";
import { PhotoSlot, type SlotShape } from "@/components/photo-book/page-slot";
import { type BookPageProps, pageName } from "@/components/photo-book/page-types";
import { SlotCaption } from "@/components/photo-book/slot-caption";
import type { PageLayout } from "@/lib/photo-book";
import { cn } from "@/lib/utils";

type BodyProps = Pick<
  BookPageProps,
  "page" | "index" | "number" | "repeated" | "photos" | "captionFor" | "actions"
>;

/** The other pages in the book with the slot's photo; none for a page left out. */
function alsoOn(photo: string, number: number | null, repeated: Map<string, number[]>): number[] {
  if (number === null) return [];
  return (repeated.get(photo) ?? []).filter((n) => n !== number);
}

/** Draws the page's photo places and captions, by their place on the page, and its title. */
interface PageParts {
  /** The page's title, typed on the page; nothing for a page without one. */
  title: ReactNode;
  slot: (i: number, shape: SlotShape, className?: string) => ReactNode;
  caption: (i: number, className?: string) => ReactNode;
}

/** The page's photo places and captions, each wired to the page's actions. */
function pageParts(props: BodyProps): PageParts {
  const { page, index, number, repeated, photos, captionFor, actions } = props;
  return {
    title:
      page.title === null ? null : (
        <input
          aria-label={`${pageName(number)} title`}
          value={page.title}
          placeholder="TITLE"
          onChange={(event) => actions.onTitle(event.target.value)}
          className="w-full shrink-0 rounded-sm bg-transparent text-[4.4cqw] leading-none font-bold uppercase outline-none placeholder:text-neutral-600 hover:bg-white/10 focus:bg-white/10"
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
          className={className}
        />
      );
    },
  };
}

/** Whether the layout puts its photos on the left and its captions on the right. */
function photosLeft(layout: PageLayout): boolean {
  return layout === "pair-left" || layout === "verticals-left";
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

/** The page's photos and captions, laid out as its layout says. */
export function PageBody(props: BodyProps) {
  const parts = pageParts(props);
  const { layout } = props.page;
  if (layout === "full") return <FullBody parts={parts} />;
  if (layout === "verticals-left" || layout === "verticals-right") {
    return <VerticalsBody parts={parts} left={photosLeft(layout)} />;
  }
  return <PairBody parts={parts} left={photosLeft(layout)} />;
}
