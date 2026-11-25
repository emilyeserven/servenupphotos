import type { CSSProperties, ReactNode } from "react";
import type { PageParts } from "@/components/photo-book/page-types";
import { type LayoutLook, photoShape, textBeside, textFirst } from "@/lib/photo-book-layouts";
import { cn } from "@/lib/utils";

/** How each text alignment sits in its room, as flexbox's justify-content. */
const ALIGN: Record<LayoutLook["align"], CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

/** The text and the photos side by side or one over the other, the text on its side, gap apart. */
function Split(props: {
  look: LayoutLook;
  text: ReactNode;
  photos: ReactNode;
  className?: string;
}) {
  const { look, text, photos, className } = props;
  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-1", className)}
      style={{ flexDirection: textBeside(look) ? "row" : "column", gap: `${look.gap}cqw` }}
    >
      {textFirst(look) ? [text, photos] : [photos, text]}
    </div>
  );
}

/** The text's room: its share of the page, the text in it where the layout aligns it. */
function TextRoom({ look, children }: { look: LayoutLook; children: ReactNode }) {
  return (
    <div
      key="text"
      className="flex min-h-0 min-w-0 shrink-0 flex-col gap-[2.5cqw] overflow-hidden [&>*]:shrink-0"
      style={{ flexBasis: `${look.textShare}%`, justifyContent: ALIGN[look.align] }}
    >
      {children}
    </div>
  );
}

/** The photos' room: the photos one under another or side by side, gap apart. */
function PhotoRoom({ look, children }: { look: LayoutLook; children: ReactNode }) {
  return (
    <div
      key="photos"
      className="flex min-h-0 min-w-0 flex-1"
      style={{ flexDirection: look.arrange === "row" ? "row" : "column", gap: `${look.gap}cqw` }}
    >
      {children}
    </div>
  );
}

/**
 * A page in a layout made on the Layouts tab: its photos arranged and shaped as the layout says,
 * and its title and captions on the layout's side, together in one column or each beside its own
 * photo, inside the layout's margin.
 */
export function CustomBody({ parts, look }: { parts: PageParts; look: LayoutLook }) {
  const indexes = Array.from({ length: look.photos }, (_, i) => i);
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-[2cqw]"
      style={{ padding: `${look.margin}cqw` }}
    >
      {look.captions === "column" ? (
        <Split
          look={look}
          text={
            <TextRoom key="text" look={look}>
              {parts.title}
              {indexes.map((i) => parts.caption(i))}
            </TextRoom>
          }
          photos={
            <PhotoRoom key="photos" look={look}>
              {indexes.map((i) => parts.slot(i, photoShape(look), "flex-1"))}
            </PhotoRoom>
          }
        />
      ) : (
        <>
          {parts.title}
          <PhotoRoom look={look}>
            {indexes.map((i) => (
              <Split
                key={i}
                look={look}
                text={
                  <TextRoom key="text" look={look}>
                    {parts.caption(i)}
                  </TextRoom>
                }
                photos={parts.slot(i, photoShape(look), "flex-1")}
              />
            ))}
          </PhotoRoom>
        </>
      )}
    </div>
  );
}
