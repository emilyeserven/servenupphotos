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
jumps to its card, such as **Cities** to the Cities card, and shows a down arrow on hover. Under them, **Places**, **Gear** and **Time** jump to their
sections.

## Sections and groups

Each section has groups, each a card listing its values with a bar as long as the value's share of the group's
biggest, and the number of photos:

| Section | Group           | Rows                                                                                                  |
| ------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| Places  | Countries       | each country, most photos first                                                                       |
| Places  | Regions         | each state, province or prefecture, most photos first; its country shows on hover; then **No region** |
| Places  | Cities          | each city, most photos first; its country shows on hover                                              |
| Gear    | Lenses by brand | the lens [metadata groups](metadata-groups.md) inside the top-level **Brand** group                   |
| Gear    | Focal length    | the top-level focal length metadata groups, widest first                                              |
| Gear    | Lenses          | each lens, most photos first                                                                          |
| Gear    | Aperture        | the top-level aperture metadata groups, every one shown even with no photos                           |
| Gear    | Shutter speed   | the top-level shutter speed metadata groups, every one shown even with no photos                      |
| Gear    | ISO             | the top-level ISO metadata groups, every one shown even with no photos                                |
| Gear    | Cameras         | each camera, most photos first, or grouped by a camera category from its **Group by** control         |
| Time    | Time of day     | Late night to Night, as the [When](portfolio-filters.md#when) picker's Hours tab groups them          |
| Time    | Year            | newest first                                                                                          |
| Time    | Season          | Spring to Winter                                                                                      |
| Time    | Month           | January to December                                                                                   |
| Time    | Day of the week | Monday to Sunday                                                                                      |

The **Lenses by brand** card's rows are the lens metadata groups set on the pipeline's Metadata Groups page inside the
top-level group named **Brand**, such as Canon and Fujinon; without a Brand group the card isn't shown. Each lens group's row says the focal lengths its lenses
cover, such as **Longer Telephoto 55–250mm**, read from the lenses' names ("EF-S55-250mm f/4-5.6 IS STM"), or for a
lens whose name doesn't say, from the focal lengths its photos were taken at. Top-level lens groups with none
in them aren't shown. Camera groups work on the **Cameras** card from its **Group by** control, at the other end of its title row: each top-level
camera group with groups in it, such as **Type**, is a choice (**By type**), and the top-level groups with none in them go together as **By group**. It
starts on **Each camera**, and it has no control until the pipeline has a camera metadata group, such
as a **Type** with Mirrorless, DSLR and Phone in it. The group names come from
the pipeline; the mm ranges don't, since a metadata group has none. A photo can be in more than one
row of a category, and the card says how many are in none of them.

## Opening and narrowing

Cards that narrow each other come in two kinds, and each sits together on one row, the same height:

- **Filter down** cards narrow the next card along, never the ones before it, such as Countries → Regions → Cities.
  They're joined by a bar in the card border color, 1em shorter than the cards at each end.
- **Linked** cards each narrow every other card in their row: **Aperture**, **Shutter speed** and **ISO**, called the
  **Exposure Triangle**. They're joined by a much shorter bar, 2rem long, in the middle of the gap.

The bars run across on a desktop and down on a phone. Each row of either kind sits in a shaded box with a small title,
**Lenses**, **Exposure Triangle** or **Calendar** (Year, Season, Month), except in a section that has nothing else, such as
Places. The other cards share a grid below.

A row opens its photos on the Grid: hovering it turns its count into **See More (37) →** without moving the number
(the ") →" after it always takes its space), and a click opens the Grid filtered to it, such as `/grid?city=Hagi`,
`/grid?season=summer`, `/grid?hour=17&hour=18&hour=19&hour=20` for Evening, or `/grid?start=2024-01-01&end=2024-12-31`
for a year.

Some cards narrow another instead: **Countries** narrows **Regions**, which narrows **Cities**; **Lenses by brand** narrows **Focal length**, which
narrows **Lenses**; and **Year** narrows **Season**, which narrows **Month**. Clicking one of their rows highlights it
and makes the other card count only its photos, with "in" and the chosen value in quiet text under its title, such as "in Japan", whose name opens
those photos on the Grid, and an X that shows every photo again. Narrowing passes down the chain, each step keeping only the photos the steps above it left: picking 2026 and then
Autumn leaves Month counting autumn 2026, saying only what the card right above it chose, "in Autumn", which opens
autumn 2026 on the Grid. Clearing one clears only that step. While a card is narrowed, its rows don't repeat the chosen value on hover, such as a city's country. Clicking the highlighted row again does the same. The page has no filters of its own, and what's
narrowed isn't kept in the URL. The Grid matches any of several places, so when a chain chooses more than one kind of
place, such as the United States and then No region, its link opens the photos themselves by ID (`?ids=…`).

Clicking a row on a linked card highlights it and makes the other two count only photos with that setting. Each linked
card lists the other cards' choices under its title, not its own, with the card's name, in card order: "with" before the
first and "and" before the rest, such as "with Fast aperture and Base ISO" on Shutter speed. Each name opens on the Grid
the photos with every choice listed
(such as `/grid?aperture=2-3.1&iso=100-200`), and its X clears only that choice. A linked card never narrows itself, so its own
rows keep counting every photo the other choices leave, and its ranges stay listed even when they come to 0.

Regions are the photos' states, provinces and prefectures, as the pipeline reads them from the EXIF. The photos without
one share a **No region** row at the bottom of Regions, which narrows Cities like any other row; its chip opens them on the
Grid with `?state=none`, which the Places filter's button shows as **No region**.

A row with no photos is left out, except on the linked cards. Every row is shown, a long group scrolling within the card (at most 24rem tall), and a group
says how many photos it couldn't count, such as photos without a lens in their EXIF ("10 photos don't say"). A focal
length row counts the photos within the range the Grid's slider would set for it, so the count matches the Grid.

> **Frontend analogy:** each card is a `groupBy` + `count` over the photo array (`lib/stats.ts`). A card that narrows
> another is like a master–detail list: its click sets a bit of `useState` in the page, and the detail card runs the
> same `filterWithCamera` the Grid uses on the chosen row's filter before counting.
