import { type RefObject, useEffect, useState } from "react";
import { PAGE_SHEET_ATTRIBUTE } from "@/components/photo-book/use-slot-dpi";
import { type CaptionBox, captionOverflows, pastEdges } from "@/lib/caption-overflow";
import { useCaptionOverflowStore } from "@/stores/caption-overflow";

/** The edges of the page sheet's printed area, inside its padding; none outside a sheet. */
function printedArea(element: HTMLElement): { top: number; right: number; bottom: number } | null {
  const sheet = element.closest<HTMLElement>(`[${PAGE_SHEET_ATTRIBUTE}]`);
  if (!sheet) return null;
  const rect = sheet.getBoundingClientRect();
  const style = getComputedStyle(sheet);
  return {
    top: rect.top + parseFloat(style.paddingTop),
    right: rect.right - parseFloat(style.paddingRight),
    bottom: rect.bottom - parseFloat(style.paddingBottom),
  };
}

/**
 * The caption text's sizes, and how far it reaches past the room its caption is given (its
 * parent) or the page's printed area.
 */
function captionBox(element: HTMLElement): CaptionBox {
  return {
    scrollWidth: element.scrollWidth,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    ...pastEdges(
      element.getBoundingClientRect(),
      element.parentElement?.getBoundingClientRect(),
      printedArea(element),
    ),
  };
}

/**
 * Whether the caption text in element overflows its room, measured again whenever it or its page
 * resizes or its text changes, and kept for the Book tab's list of overflowing captions by
 * `<page ID>:<slot>`.
 */
export function useCaptionOverflow(
  element: RefObject<HTMLElement | null>,
  key: string | undefined,
  text: string,
): boolean {
  const [over, setOver] = useState(false);
  const setCaption = useCaptionOverflowStore((state) => state.setCaption);
  useEffect(() => {
    const el = element.current;
    if (!el) return;
    const measure = () => {
      const next = captionOverflows(captionBox(el));
      setOver(next);
      if (key) setCaption(key, { text, over: next });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.parentElement) observer.observe(el.parentElement);
    const sheet = el.closest(`[${PAGE_SHEET_ATTRIBUTE}]`);
    if (sheet) observer.observe(sheet);
    return () => observer.disconnect();
  }, [element, key, text, setCaption]);
  return over;
}
