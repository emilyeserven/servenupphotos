import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SidebarState {
  /** Whether the sidebar is expanded; when false it's collapsed to a rail of icons. */
  open: boolean;
  /** Expands or collapses the sidebar. */
  setOpen: (open: boolean) => void;
}

/** Whether the sidebar is expanded, kept in the browser so it stays that way after a reload. */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      open: true,
      setOpen: (open) => set({ open }),
    }),
    { name: "pipeline-sidebar", storage: createJSONStorage(() => localStorage) },
  ),
);
