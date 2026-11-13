import { createFileRoute } from "@tanstack/react-router";
import { MonitorIcon, MoonIcon, Settings, SunIcon } from "lucide-react";
import { useState } from "react";
import { useScriptDisplay } from "@/components/script-display-provider";
import { SettingChoices, type SettingOption } from "@/components/setting-choices";
import { SettingsSection } from "@/components/settings-section";
import { SiteHomeLink } from "@/components/site-home-link";
import { type Theme, useTheme } from "@/components/theme-provider";
import { OptionCheckbox } from "@/components/view-options-button";
import type { ScriptDisplay } from "@/lib/localize";
import { readShowLowerTier, saveShowLowerTier } from "@/lib/lower-tier";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

// Least to most native. A name without the chosen way saved shows the most native way it has
// short of it, down to English.
const scriptOptions: SettingOption<ScriptDisplay>[] = [
  { value: "english", label: "English" },
  { value: "romanized", label: "Romanized" },
  { value: "phonetic", label: "Phonetic" },
  { value: "native", label: "Native" },
];

const themeOptions: SettingOption<Theme>[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

/**
 * The portfolio's Settings page, linked from the bottom of the site menu: how place names are
 * written, the color theme, and whether Lower Tier photos show. Each is remembered in this browser.
 */
function SettingsPage() {
  const { script, setScript } = useScriptDisplay();
  const { theme, setTheme } = useTheme();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16 sm:px-6">
      <header>
        <SiteHomeLink className="mb-1" />
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <Settings className="size-8 text-muted-foreground" aria-hidden />
          Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          How the portfolio looks for you. Each choice is remembered in this browser only.
        </p>
      </header>
      <SettingsSection
        id="script-display"
        title="Script display"
        description="How the names of places, cities and countries are written across the portfolio: in English, romanized, as they're said locally, or in their own script, such as Tokyo, Tōkyō, とうきょう or 東京. A name without the chosen way shows the closest one it has."
      >
        <SettingChoices
          labelledBy="script-display"
          options={scriptOptions}
          value={script}
          onChange={setScript}
        />
      </SettingsSection>
      <SettingsSection
        id="color-theme"
        title="Color theme"
        description="Light or dark colors, or System to follow your device's setting and change with it."
      >
        <SettingChoices
          labelledBy="color-theme"
          options={themeOptions}
          value={theme}
          onChange={setTheme}
        />
      </SettingsSection>
      <LowerTierSection />
    </div>
  );
}

/**
 * The **Show Lower Tier photos** checkbox. Every view reads the photos once as the page loads, so
 * changing it reloads the page.
 */
function LowerTierSection() {
  const [show] = useState(readShowLowerTier);
  const change = (next: boolean) => {
    saveShowLowerTier(next);
    window.location.reload();
  };
  return (
    <SettingsSection
      id="lower-tier"
      title="Lower Tier photos"
      description="Lower Tier photos are ones worth keeping that aren't among the best. They're left out of every view unless this is on. Changing it reloads the page."
    >
      <OptionCheckbox label="Show Lower Tier photos" checked={show} onChange={change} />
    </SettingsSection>
  );
}
