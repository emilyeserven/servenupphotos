import type { ReactNode } from "react";
import { PhotoSlot, SlotCaption, type SlotShape } from "@/components/photo-book/page-slot";
import type { BookPageProps } from "@/components/photo-book/page-types";
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

/** Draws the page's photo places and captions, by their place on the page. */
interface PageParts {
  slot: (i: number, shape: SlotShape, className?: string) => ReactNode;
  caption: (i: number, className?: string) => ReactNode;
}

/** The page's photo places and captions, each wired to the page's actions. */
function pageParts(props: BodyProps): PageParts {
  const { page, index, number, repeated, photos, captionFor, actions } = props;
  return {
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
        "grid min-h-0 gap-[4%]",
        left ? "grid-cols-[3fr_2fr]" : "grid-cols-[2fr_3fr]",
        className,
      )}
    >
      {left ? photos : captions}
      {left ? captions : photos}
    </div>
  );
}

/** One landscape photo over the page, its caption at the bottom. */
function FullBody({ parts }: { parts: PageParts }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3%]">
      {parts.slot(0, "landscape", "flex-1")}
      {parts.caption(0, "h-[18%] shrink-0 text-center")}
    </div>
  );
}

/** Two portrait photos side by side on one side, their captions stacked on the other. */
function VerticalsBody({ parts, left }: { parts: PageParts; left: boolean }) {
  const align = left ? undefined : "text-right";
  return (
    <Sides
      left={left}
      className="flex-1"
      photos={
        <div className="grid min-h-0 grid-cols-2 gap-[4%]">
          {parts.slot(0, "portrait")}
          {parts.slot(1, "portrait")}
        </div>
      }
      captions={
        <div className="grid min-h-0 grid-rows-2 gap-[4%]">
          {parts.caption(0, align)}
          {parts.caption(1, align)}
        </div>
      }
    />
  );
}

/** Two landscape photos down one side, each caption beside its photo. */
function PairBody({ parts, left }: { parts: PageParts; left: boolean }) {
  return (
    <div className="grid min-h-0 flex-1 grid-rows-2 gap-[4%]">
      {[0, 1].map((i) => (
        <Sides
          key={i}
          left={left}
          photos={parts.slot(i, "landscape")}
          captions={parts.caption(i, left ? undefined : "text-right")}
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
