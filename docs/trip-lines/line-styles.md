# Line styles

Every drawing of a trip line uses the same style, from `tripLineStyle(mode, { onLine, colour }, dark, size)` in `portfolio/src/lib/map-theme.ts`: the portfolio's Map, the pipeline's Trip map, the route map on the Route page, a day's preview in the list, a Trip card, and the Timeline's sketches. MapLibre layers read it with `tripLinePaint` and SVG drawings with `tripLineStroke`, which turns its dashes (in line widths, as MapLibre counts them) into pixels.

| Line | Drawn as | Map | Sketch |
| --- | --- | --- | --- |
| Walk | Solid blue, lighter in dark mode | 3 | 2 |
| Ride on a picked line | Solid in the line's color, or the ride blue without one | 3 | 2 |
| Drive | Solid light blue | 3 | 2 |
| Hop with no line | Dashed 2-2, purple (in a line's color when picked but not drawn along its track) | 2 | 1.5 |
| A Trip's ferry | Teal dots | 3 | 2 |
| A Trip's flight | Dashed 3-2, pink | 2 | 1.5 |

The numbers are widths in pixels: "Map" covers the portfolio's Map, the Trip map and the route map. How see-through a line is (fainter for a preview, or outside the group shown on its own) stays with each drawing. A new drawing of trip lines reads `tripLineStyle` rather than picking its own colors, widths or dashes.

> **Frontend analogy:** it's a design token for lines, like a shared `buttonVariants()` that every button reads, so a dashed line means the same thing on every page.
