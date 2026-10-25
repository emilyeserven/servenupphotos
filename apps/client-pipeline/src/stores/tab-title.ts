import { useEffect } from "react";
import { create } from "zustand";

/** What the browser tab's title names ahead of the page, such as the photo being edited. */
interface TabTitleState {
  /** The name of the photo the page shows; null on a page that isn't about one photo. */
  subject: string | null;
  setSubject: (subject: string | null) => void;
}

export const useTabTitleStore = create<TabTitleState>()((set) => ({
  subject: null,
  setSubject: (subject) => set({ subject }),
}));

/** The app's name, last in every tab title. */
const APP_NAME = "Photo Pipeline";

/**
 * The browser tab's title: the photo's name when there is one, then the page, then the app, each
 * once, so the Status page, which is named after the app, isn't named twice.
 */
export function tabTitle(page: string, subject: string | null): string {
  const parts = [subject, page, APP_NAME].filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(" · ");
}

/** Shows subject, such as the photo being edited, in the browser tab's title while mounted. */
export function useTabSubject(subject: string | null) {
  const setSubject = useTabTitleStore((state) => state.setSubject);
  useEffect(() => {
    setSubject(subject?.trim() || null);
    return () => setSubject(null);
  }, [subject, setSubject]);
}
