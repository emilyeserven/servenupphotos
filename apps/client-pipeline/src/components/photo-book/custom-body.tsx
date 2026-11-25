import { type CSSProperties, type ReactNode, useRef } from "react";
import type { PageParts } from "@/components/photo-book/page-types";
import { usePhotoEdges } from "@/components/photo-book/photo-edges";
import {
  type LayoutLook,
  photoShape,
  textBeside,
  textFirst,
  titlePlace,
} from "@/lib/photo-book-layouts";
import { cn } from "@/lib/utils";

/** How each text alignment sits in its room, as flexbox's justify-content. */
const ALIGN: Record<LayoutLook["align"], CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

/**
 * The text and the photos side by side or one over the other, the text in its room on its side,
 * gap apart. With the layout lining the text up with the photos, its room is only as long as the
 * photos are drawn.
 */
function Split(props: {
  look: LayoutLook;
  text: ReactNode;
  photos: ReactNode;
  className?: string;
}) {
  const { look, text, photos, className } = props;
  const root = useRef<HTMLDivElement>(null);
  const beside = textBeside(look);
  const edges = usePhotoEdges(root, look.alignTo === "photo", beside);
  const room = (
    <TextRoom key="text" look={look} style={edges}>
      {text}
    </TextRoom>
  );
  return (
    <div
      ref={root}
      className={cn("flex min-h-0 min-w-0 flex-1", className)}
      style={{ flexDirection: beside ? "row" : "column", gap: `${look.gap}cqw` }}
    >
      {textFirst(look) ? [room, photos] : [photos, room]}
    </div>
  );
}

/** The text's room: its share of the page, the text in it where the layout aligns it. */
function TextRoom(props: { look: LayoutLook; style: CSSProperties; children: ReactNode }) {
  const { look, style, children } = props;
  return (
    <div
      className="flex min-h-0 min-w-0 shrink-0 flex-col gap-[2.5cqw] overflow-hidden [&>*]:shrink-0"
      style={{ flexBasis: `${look.textShare}%`, justifyContent: ALIGN[look.align], ...style }}
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

/** The captions together in one column on the text's side, with the title when the layout puts it there. */
function ColumnBody(props: { parts: PageParts; look: LayoutLook; title: ReactNode }) {
  const { parts, look, title } = props;
  const indexes = Array.from({ length: look.photos }, (_, i) => i);
  return (
    <Split
      look={look}
      text={
        <>
          {title}
          {indexes.map((i) => parts.caption(i))}
        </>
      }
      photos={
        <PhotoRoom key="photos" look={look}>
          {indexes.map((i) => parts.slot(i, photoShape(look), "flex-1"))}
        </PhotoRoom>
      }
    />
  );
}

/** Each caption beside its own photo, the first one under the title when the layout puts it there. */
function BesideBody(props: { parts: PageParts; look: LayoutLook; title: ReactNode }) {
  const { parts, look, title } = props;
  const indexes = Array.from({ length: look.photos }, (_, i) => i);
  return (
    <PhotoRoom look={look}>
      {indexes.map((i) => (
        <Split
          key={i}
          look={look}
          text={
            i === 0 && title ? (
              <>
                {title}
                {parts.caption(0)}
              </>
            ) : (
              parts.caption(i)
            )
          }
          photos={parts.slot(i, photoShape(look), "flex-1")}
        />
      ))}
    </PhotoRoom>
  );
}

/**
 * A page in a layout made on the Layouts tab: its photos arranged and shaped as the layout says,
 * and its captions on the layout's side, together in one column or each beside its own photo,
 * inside the layout's margin. The title goes with the captions, across the top, or nowhere, as the
 * layout says.
 */
export function CustomBody({ parts, look }: { parts: PageParts; look: LayoutLook }) {
  const place = titlePlace(look);
  const inText = place === "text" ? parts.title : null;
  const Body = look.captions === "column" ? ColumnBody : BesideBody;
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-[2cqw]"
      style={{ padding: `${look.margin}cqw` }}
    >
      {place === "top" && parts.title}
      <Body parts={parts} look={look} title={inText} />
    </div>
  );
}
