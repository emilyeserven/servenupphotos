---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/portfolio/src/**"
---

# Trip line styles

Every map or sketch of trip lines takes its color, width and dashes from `tripLineStyle` in `@portfolio/lib/map-theme` (MapLibre paint via `tripLinePaint`, SVG via `tripLineStroke`), never its own numbers ([Line styles](../../docs/trip-lines.md#line-styles)).
