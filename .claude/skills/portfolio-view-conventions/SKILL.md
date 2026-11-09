---
name: portfolio-view-conventions
description: Use when changing a portfolio view (apps/portfolio/src/routes/*.tsx) or a pipeline page that shows one, such as the Gallery, so its options, pickers and imports match the other views.
---

# Portfolio view conventions

Every portfolio view (`apps/portfolio/src/routes/grid.tsx`, `timeline.tsx`, `map.tsx`, `color.tsx`, `graph.tsx`,
`stats.tsx`, `lucky.tsx`, …) and the pipeline's Gallery, which borrows the Grid's filters, share the parts below.
Read the feature's own doc first: `docs/portfolio-<view>.md`, `docs/portfolio-filters.md`, `docs/gallery.md`.

## Where the photos come from

- Every view reads `photos` (or calls `photosFromData`) from `apps/portfolio/src/lib/photos.ts`, which turns the
  committed photo JSON (or `ALLPHOTOS.local.json` from `pnpm photos:local`) into the `Photo` type. A new field a
  view needs goes on `Photo` there, not into a view's own parsing. The fields are listed in `docs/data-model.md`.
- The Gallery reads its photos the same way (`photosFromData` in `apps/client-pipeline/src/lib/smart-album-photos.ts`),
  so a change to `Photo` reaches both apps.

## Display Options

Every view's display options use `ViewOptionsButton` in `apps/portfolio/src/components/view-options-button.tsx`.
Flyouts to copy from: `grid-view-options.tsx`, `timeline-display-options.tsx`, `map-display-options.tsx`,
`color-display-options.tsx` and `graph-builder/graph-display.tsx` in the same folder.

- [ ] The button says **Display Options** beside its eye. Only the Map's floating controls pass `iconOnly` (eye only).
- [ ] `choices` (left column) holds `OptionChoices` rows and sliders; `checks` (right column) holds checkboxes, each
      inside a titled `OptionGroup` (`OptionCheckbox` rows). They stack on a phone. A flyout with only checkboxes
      leaves `choices` out.
- [ ] Next to search and **Show filters**, the button goes at the right end of that row with `align="end"`.
- [ ] Pass `onReset` when the options have defaults to go back to, and keep the options in the URL search params when
      a link should carry them (see how `GridViewOptions` navigates with `replace: true`).

## Filter pickers

Build a filter picker on `SectionPicker` (`apps/portfolio/src/components/section-picker.tsx`) and follow
[Picker conventions](../../../docs/portfolio-filters.md#picker-conventions):

- [ ] More about a section goes behind `InfoButton` (`components/info-button.tsx`), the last thing in the section's
      top row, and what it shows goes in `SectionPicker`'s `aside` panel on the right (pass a wider `width` while it
      shows). Never inside the controls or in a hover.
- [ ] **Group by** and **Sort** are small `PickMenu` icon buttons (`components/pick-menu.tsx`) left of the (i), not
      tab rows or segmented controls.
- [ ] Grouping is off by default: the first grouping is **None**, the list A to Z.
- [ ] Choice lists are text: a `ChoiceRow` (`components/choice-row.tsx`) has its check, name and count, no icon or
      picture (the Graph page's **Graph type** list is the one exception).
- [ ] A button that opens filters clears them with an X: `FilterPickerButton` or `ClearableTrigger` with `onClear`,
      never a separate Clear button. A section at its default says "Any".

## Imports shared with the pipeline's Gallery

The Gallery imports the Grid's filters (`CameraFilterBar`, `VisualsPicker`, … in
`apps/client-pipeline/src/components/gallery/grid-filters.tsx`) through the `@portfolio/*` alias (see "The portfolio
Grid's filters" in `docs/gallery.md`):

- [ ] A file reached from those imports uses `@portfolio/` for its own imports, not `@/`, since `@/` means a
      different folder in each app. `view-options-button.tsx` and `section-picker.tsx` are such files.
- [ ] A package such a file imports has to be in `apps/client-pipeline/package.json` **and** in `resolve.dedupe` of
      its `vite.config.ts`, or the pipeline's build fails with "failed to resolve import".

## Finish

- [ ] Update `docs/portfolio-<view>.md` (or `docs/portfolio-filters.md`) for the change in behavior.
- [ ] Look at it: `pnpm shot portfolio /<view> --out <dir>` (desktop, light); add `--mobile` only when the layout
      changes, and `pnpm shot pipeline /gallery --out <dir>` when a shared file changed.
- [ ] `pnpm check` (oxlint, oxfmt, typecheck, fallow: functions at cyclomatic complexity 4 or under) and `pnpm build`.
