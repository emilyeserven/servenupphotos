import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Light, dark, or whichever the computer is set to. */
export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  /** The chosen color mode. */
  mode: ThemeMode;
  /** Chooses a color mode. */
  setMode: (mode: ThemeMode) => void;
}

/**
 * The pipeline's color mode, kept in the browser so it stays after a reload. `index.html` reads the
 * same `pipeline-theme` key before the app loads, so a dark page doesn't flash light first.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
    }),
    { name: "pipeline-theme", storage: createJSONStorage(() => localStorage) },
  ),
);

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

/** Puts the `dark` class on the page when the mode is dark, or is system and the computer is dark. */
function applyMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && darkQuery.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Keeps the page's colors in step with the chosen mode and, in system mode, with the computer's. */
export function syncTheme() {
  applyMode(useThemeStore.getState().mode);
  useThemeStore.subscribe((state) => applyMode(state.mode));
  darkQuery.addEventListener("change", () => applyMode(useThemeStore.getState().mode));
}
