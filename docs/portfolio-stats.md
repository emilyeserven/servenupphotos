# Portfolio Numbers

The portfolio's Numbers page (`/stats`, `apps/portfolio/src/routes/stats.tsx`), once called Stats, counts the photos by
gear, place and time. It's in the site menu after Tags, with the other small views, and just before
[Graph](portfolio-graph.md), which draws its counts as a graph of your own; like them, the homepage doesn't link to it.
The page still lives at `/stats`, and its spotlight zone is still called **Stats Header**.

When an album is picked for the **Stats Header** zone on the pipeline's [Site Spotlight](publish.md#site-spotlight) page,
its photos fade in and out across the top of the page, up to 30% of the screen's height, with the title under them (see
[Header spotlights](publish.md#header-spotlights)). There's no Jump to Cover Image button here, since the page lists no
photos to jump to.

At the top are six headline numbers: photos, countries, regions, cities, cameras and years. Each but photos is a link that
jumps to its card, such as **Cities** to the Cities card, and shows a down arrow on hover. Under them, **Gear**, **Places** and **Time** jump to their
sections.

## Sections and groups

Each section has groups, each a card listing its values with a bar as long as the value's share of the group's
biggest, and the number of photos:

| Section | Group                       | Rows                                                                                                  |
| ------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Gear    | Cameras                     | each camera, most photos first, or grouped by a camera category from its **Group by** control         |
| Gear    | Lenses by type, by brand, … | one card, its **Group by** control picking a top-level lens [metadata group](metadata-groups.md)      |
| Gear    | Focal length                | the top-level focal length metadata groups, widest first                                              |
| Gear    | Lenses                      | each lens, most photos first                                                                          |
| Places  | Countries                   | each country, most photos first                                                                       |
| Places  | Regions                     | each state, province or prefecture, most photos first; its country shows on hover; then **No region** |
| Places  | Cities                      | each city, most photos first; its country shows on hover                                              |
| Time    | Time of day                 | Late night to Night, as the [When](portfolio-filters.md#when) picker's Hours tab groups them          |
| Time    | Year                        | newest first                                                                                          |
| Time    | Season                      | Spring to Winter                                                                                      |
| Time    | Month                       | January to December                                                                                   |
| Time    | Day of the week             | Monday to Sunday                                                                                      |

Lens categories come from the lens metadata groups set on the pipeline's Metadata Groups page: a top-level group such
as **Type**, with **Prime** and **Telephoto** in it, is **By type** in the lens card's **Group by** control, at the other end of its title
row, which opens on it and titles the card **Lenses by type**. Each lens group's row says the focal lengths its lenses
cover, such as **Longer Telephoto 55–250mm**, read from the lenses' names ("EF-S55-250mm f/4-5.6 IS STM"), or for a
lens whose name doesn't say, from the focal lengths its photos were taken at. Top-level lens groups with none
in them go together as **By group**. Camera groups work the same way on the **Cameras** card, whose
**Group by** control starts on **Each camera**; it has no control until the pipeline has a camera metadata group, such
as a **Type** with Mirrorless, DSLR and Phone in it. The group names come from
the pipeline; the mm ranges don't, since a metadata group has none. A photo can be in more than one
row of a category, and the card says how many are in none of them.

## Opening and narrowing

Cards that narrow each other sit together on one row, the same height, joined by a bar in the card border color, 1em shorter than the cards at each end, from each card to the one it narrows:
across on a desktop, down on a phone. The other cards share a grid below.

A row opens its photos on the Grid: hovering it turns its count into **See More (37) →** without moving the number
(the ") →" after it always takes its space), and a click opens the Grid filtered to it, such as `/grid?city=Hagi`,
`/grid?season=summer`, `/grid?hour=17&hour=18&hour=19&hour=20` for Evening, or `/grid?start=2024-01-01&end=2024-12-31`
for a year.

Some cards narrow another instead: **Countries** narrows **Regions**, which narrows **Cities**; the lens card narrows **Focal length**, which
narrows **Lenses**; and **Year** narrows **Season**, which narrows **Month**. Clicking one of their rows highlights it
and makes the other card count only its photos, with "in" and the chosen value in quiet text under its title, such as "in Japan", whose name opens
those photos on the Grid, and an X that shows every photo again. Narrowing passes down the chain, each step keeping only the photos the steps above it left: picking 2026 and then
Autumn leaves Month counting autumn 2026, saying only what the card right above it chose, "in Autumn", which opens
autumn 2026 on the Grid. Clearing one clears only that step, and picking another lens category in the **Group by** control clears what it narrowed. While a card is narrowed, its rows don't repeat the chosen value on hover, such as a city's country. Clicking the highlighted row again does the same. The page has no filters of its own, and what's
narrowed isn't kept in the URL. The Grid matches any of several places, so when a chain chooses more than one kind of
place, such as the United States and then No region, its link opens the photos themselves by ID (`?ids=…`).

Regions are the photos' states, provinces and prefectures, as the pipeline reads them from the EXIF. The photos without
one share a **No region** row at the bottom of Regions, which narrows Cities like any other row; its chip opens them on the
Grid with `?state=none`, which the Places filter's button shows as **No region**.

A row with no photos is left out. Every row is shown, a long group scrolling within the card (at most 24rem tall), and a group
says how many photos it couldn't count, such as photos without a lens in their EXIF ("10 photos don't say"). A focal
length row counts the photos within the range the Grid's slider would set for it, so the count matches the Grid.

> **Frontend analogy:** each card is a `groupBy` + `count` over the photo array (`lib/stats.ts`). A card that narrows
> another is like a master–detail list: its click sets a bit of `useState` in the page, and the detail card runs the
> same `filterWithCamera` the Grid uses on the chosen row's filter before counting.
