import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { NO_FOCUS, type SocialFocus } from "@/lib/social-focus";

interface SocialFocusState {
  /** The filters the Instagram calendar's photo picker starts with. */
  focus: SocialFocus;
  /** Changes some of the Focus's filters. */
  setFocus: (change: Partial<SocialFocus>) => void;
  /** Clears every filter, so the picker offers every photo again. */
  clearFocus: () => void;
}

/** The Instagram calendar's Focus, kept in the browser so it stays set after a reload. */
export const useSocialFocusStore = create<SocialFocusState>()(
  persist(
    (set) => ({
      focus: NO_FOCUS,
      setFocus: (change) => set((state) => ({ focus: { ...state.focus, ...change } })),
      clearFocus: () => set({ focus: NO_FOCUS }),
    }),
    {
      name: "pipeline-instagram-focus",
      storage: createJSONStorage(() => localStorage),
      // A Focus saved before a filter was added gets that filter empty.
      merge: (saved, current) => ({
        ...current,
        focus: { ...NO_FOCUS, ...(saved as Partial<SocialFocusState> | undefined)?.focus },
      }),
    },
  ),
);
