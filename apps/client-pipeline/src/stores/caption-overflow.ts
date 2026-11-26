import { create } from "zustand";

/** One caption's measurement: the text that was measured, and whether it overflowed its room. */
interface MeasuredCaption {
  text: string;
  over: boolean;
}

/**
 * Whether each caption drawn on a Photo Book page overflows its room, by `<page ID>:<slot>`, kept
 * after the page is no longer drawn, so the Book tab can list them. Captions are sized in shares of
 * the page's width, so a small preview measures the same as a page.
 */
interface CaptionOverflowState {
  captions: Map<string, MeasuredCaption>;
  setCaption: (key: string, caption: MeasuredCaption) => void;
}

export const useCaptionOverflowStore = create<CaptionOverflowState>()((set, get) => ({
  captions: new Map(),
  setCaption: (key, caption) => {
    const old = get().captions.get(key);
    if (old?.text === caption.text && old.over === caption.over) return;
    set({ captions: new Map(get().captions).set(key, caption) });
  },
}));
