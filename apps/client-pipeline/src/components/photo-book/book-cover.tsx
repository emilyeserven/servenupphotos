import type { CSSProperties } from "react";
import type { BlurbSizes } from "@/lib/photo-book";
import { type CoverBox, FRONT_INSETS, type FullCover, coverParts } from "@/lib/photo-book-cover";

/** An inset of the front's as a share of its width, in `cqw`. */
const cqw = (share: number) => `${share * 100}cqw`;

/** The printed books' type: Helvetica, with Noto Sans Arabic for Arabic letters. */
const COVER_FONT = "font-[Book_Arabic,Helvetica_Neue,Helvetica,Arial,sans-serif]";

/** Trims a line's box to its capitals' top and its baseline, so it's placed by its letters, as a layout program does. */
const TRIM: CSSProperties = { textBox: "trim-both cap alphabetic" };

/** A part of the cover's sheet placed where it is, in percent of the sheet. */
function boxStyle(box: CoverBox): CSSProperties {
  return {
    position: "absolute",
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

interface CoverSheetProps {
  cover: FullCover;
  sizes: BlurbSizes;
  /**
   * Draws dashed lines where Blurb trims the cover and where the spine folds, for the Cover tab's
   * preview only; never printed.
   */
  guides?: boolean;
}

/**
 * The book's whole cover as Blurb prints it, the back, spine and front on one sheet the shape of
 * Blurb's cover PDF, in the style of Serven Up Photos Vol. 3: a plain background running to every
 * edge, the title large and bold in the front's top left, one line a line, the author in its bottom
 * left and the volume in italics in its bottom right, a plain back, and the spine's text down the
 * spine. The front's words are placed inside its trimmed edges, sized in shares of its width as
 * Vol. 3's are.
 */
export function CoverSheet({ cover, sizes, guides = false }: CoverSheetProps) {
  const parts = coverParts(sizes);
  return (
    <div
      className={`relative w-full overflow-hidden ${COVER_FONT}`}
      style={{
        aspectRatio: `${sizes.coverWidth} / ${sizes.coverHeight}`,
        background: cover.background,
        color: cover.color,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {guides && <CoverGuides parts={parts} />}
      <div
        style={{ ...boxStyle(parts.spine), containerType: "size" }}
        className="flex items-center justify-center"
      >
        <span
          className="font-bold whitespace-nowrap"
          style={{ writingMode: "vertical-rl", fontSize: "42cqw" }}
        >
          {cover.spine}
        </span>
      </div>
      <div style={{ ...boxStyle(parts.frontTrim), containerType: "inline-size" }}>
        <FrontWords cover={cover} />
      </div>
    </div>
  );
}

/**
 * The front's words, sized and placed in shares of the trimmed front's width as on Vol. 3's
 * cover: the title's capitals 1% below the top, 8% in, its lines 17.5% tall with 1.2 between
 * them; the author and volume 5.65% tall, their baseline 4.2% above the bottom, the volume 3.5%
 * from the right.
 */
function FrontWords({ cover }: { cover: FullCover }) {
  return (
    <>
      <div
        className="absolute font-bold whitespace-pre-line"
        style={{
          ...TRIM,
          left: cqw(FRONT_INSETS.left),
          right: cqw(FRONT_INSETS.right),
          top: cqw(FRONT_INSETS.title),
          fontSize: "17.5cqw",
          lineHeight: 1.2,
        }}
      >
        {cover.title}
      </div>
      <div
        className="absolute flex items-baseline justify-between gap-[4cqw]"
        style={{
          left: cqw(FRONT_INSETS.left),
          right: cqw(FRONT_INSETS.right),
          bottom: cqw(FRONT_INSETS.bottom),
          fontSize: "5.65cqw",
          lineHeight: 1.2,
        }}
      >
        <span style={TRIM}>{cover.author}</span>
        <span className="italic" style={TRIM}>
          {cover.volume}
        </span>
      </div>
    </>
  );
}

/** Dashed lines where Blurb trims the cover's edges and where the spine folds. */
function CoverGuides({ parts }: { parts: ReturnType<typeof coverParts> }) {
  const trim = parts.frontTrim;
  const lines: CoverBox[] = [
    {
      left: 100 - trim.left - trim.width,
      top: trim.top,
      width: 2 * (trim.left + trim.width) - 100,
      height: trim.height,
    },
    parts.spine,
  ];
  return lines.map((box, i) => (
    <div
      key={i}
      aria-hidden
      className="pointer-events-none absolute border border-dashed opacity-50"
      style={{ ...boxStyle(box), borderColor: "currentColor" }}
    />
  ));
}
