# Portfolio Settings

`/settings` on the portfolio holds the visitor's own settings, each with a few sentences on what it changes. It's linked
as **Settings**, with a gear, at the bottom of the site menu, under the view links (`components/site-menu.tsx`). The
page is `routes/settings.tsx`; each setting is a `SettingsSection` (`components/settings-section.tsx`): its name as a
heading, its description, and its control. Every choice is kept in the visitor's browser (`localStorage`), so it
applies only there.

> **Frontend analogy:** nothing here reaches a server. It's the same as a "Preferences" screen in a single-page app
> whose answers live in `localStorage`, read once as the app starts.

| Setting           | Choices                               | Default | Kept under                 |
| ----------------- | ------------------------------------- | ------- | -------------------------- |
| Script display    | English, Romanized, Phonetic, Native  | English | `servenup-script-display`  |
| Color theme       | Light, Dark, System                   | System  | `servenup-theme`           |
| Lower Tier photos | **Show Lower Tier photos** (checkbox) | off     | `servenup-show-lower-tier` |

- **Script display** picks how place, city and country names are written. See
  [Places and localizations](places-and-localizations.md#on-the-portfolio).
- **Color theme** picks light or dark colors, or follows the device with System.
- **Show Lower Tier photos** brings back the photos marked Lower Tier in the pipeline. A Lower Tier photo keeps
  `"lowerTier": true` in its photo JSON and in `ALLPHOTOS.json`; `photos.ts` reads it as the photo's `lowerTier`, and
  `photos`, which every view reads, leaves those photos out unless this is on (`shownTiers` in `lib/lower-tier.ts`).
  Since every view reads the photos once as the page loads, changing it reloads the page. The build steps that run in
  Node (the map's place pages and link previews) can't read the setting, so they leave Lower Tier photos out. A link
  to a Lower Tier photo opens on the Grid without it while the setting is off.

The page has its own spotlight zone, **Settings Header** (`"settings-header"`), picked on the pipeline's
[Site Spotlight](publish.md#site-spotlight) page: with an album picked, its photos fade in and out above the title like
the [Grid](portfolio-grid.md)'s header. It has no **Jump to Cover Image** button, since the page lists no photos.
