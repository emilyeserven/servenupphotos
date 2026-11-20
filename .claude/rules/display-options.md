---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/portfolio/src/**"
---

# Display options

Every portfolio view's display options use `ViewOptionsButton` (`components/view-options-button.tsx`): a **Display Options** button (eye and words; the Map alone is eye only) whose flyout puts `choices` (`OptionChoices`, sliders) in the left column and `checks` (checkboxes in titled `OptionGroup`s) in the right, stacking on a phone (a flyout with only checkboxes leaves `choices` out). Next to search and **Show filters**, it goes at the right end of that row with `align="end"`.
