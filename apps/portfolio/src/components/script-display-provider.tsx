import { createContext, type ReactNode, useContext, useState } from "react";
import { SCRIPT_DISPLAYS, type ScriptDisplay } from "@portfolio/lib/localize";

const STORAGE_KEY = "servenup-script-display";

interface ScriptDisplayContextValue {
  script: ScriptDisplay;
  setScript: (script: ScriptDisplay) => void;
}

const ScriptDisplayContext = createContext<ScriptDisplayContextValue | null>(null);

function readStoredScript(): ScriptDisplay {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ScriptDisplay | null;
    if (stored && SCRIPT_DISPLAYS.includes(stored)) return stored;
  } catch {
    // Storage can be blocked (private mode, disabled cookies); fall back to English.
  }
  return "english";
}

/** Holds the visitor's Script Display choice, remembered in their browser. */
export function ScriptDisplayProvider({ children }: { children: ReactNode }) {
  const [script, setScriptState] = useState<ScriptDisplay>(readStoredScript);

  const setScript = (next: ScriptDisplay) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore; the choice still applies for this visit.
    }
    setScriptState(next);
  };

  return <ScriptDisplayContext value={{ script, setScript }}>{children}</ScriptDisplayContext>;
}

/** How place, city and country names are written, as chosen in the menu. */
export function useScriptDisplay() {
  const context = useContext(ScriptDisplayContext);
  if (!context) throw new Error("useScriptDisplay must be used within a ScriptDisplayProvider");
  return context;
}
