# Portfolio Stats

The portfolio's Stats page (`/stats`, `apps/portfolio/src/routes/stats.tsx`) counts the photos by gear, place and time.
It's in the site menu after Tags, with the other small views; like them, the homepage doesn't link to it.

At the top are five headline numbers: photos, countries, cities, cameras and years. Under them, **Gear**, **Places**
and **Time** jump to their sections.

## Sections and groups

Each section has groups, each a card listing its values with a bar as long as the value's share of the group's
biggest, and the number of photos:

| Section | Group                       | Rows                                                                                         |
| ------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| Gear    | Cameras                     | each camera, most photos first                                                               |
| Gear    | Lenses by brand, by type, … | one card for each top-level lens [metadata group](metadata-groups.md) with groups in it      |
| Gear    | Lenses                      | each lens, most photos first                                                                 |
| Gear    | Focal length                | the top-level focal length metadata groups, widest first                                     |
| Places  | Countries                   | each country, most photos first                                                              |
| Places  | Cities                      | each city, most photos first; its country shows on hover                                     |
| Time    | Time of day                 | Late night to Night, as the [When](portfolio-filters.md#when) picker's Hours tab groups them |
| Time    | Season                      | Spring to Winter                                                                             |
| Time    | Month                       | January to December                                                                          |
| Time    | Day of the week             | Monday to Sunday                                                                             |
| Time    | Year                        | newest first                                                                                 |

Lens categories come from the lens metadata groups set on the pipeline's Metadata Groups page: a top-level group such
as **Type**, with **Prime** and **Telephoto** in it, makes a **Lenses by type** card. Top-level lens groups with none
in them go together on a **Lens groups** card, and camera groups work the same way. A photo can be in more than one
row of a category, and the card says how many are in none of them.

## Opening and narrowing

A row opens its photos on the Grid: hovering it turns its count into **See More (37) →** without moving the number
(the ") →" after it always takes its space), and a click opens the Grid filtered to it, such as `/grid?city=Hagi`,
`/grid?season=summer`, `/grid?hour=17&hour=18&hour=19&hour=20` for Evening, or `/grid?start=2024-01-01&end=2024-12-31`
for a year.

Some cards narrow another instead: **Countries** narrows **Cities**, **Season** narrows **Month**, and each lens
category narrows **Lenses**. Clicking one of their rows highlights it and makes the other card count only its photos,
with the chosen value at the top, such as **Japan 57 →**, which opens those photos on the Grid, and an X that shows
every photo again. While a card is narrowed, its rows don't repeat the chosen value on hover, such as a city's country. Clicking the highlighted row again does the same. The page has no filters of its own, and what's
narrowed isn't kept in the URL.

A row with no photos is left out. A group longer than 8 rows shows its first 8 and a **Show all** button, and a group
says how many photos it couldn't count, such as photos without a lens in their EXIF ("10 photos don't say"). A focal
length row counts the photos within the range the Grid's slider would set for it, so the count matches the Grid.

> **Frontend analogy:** each card is a `groupBy` + `count` over the photo array (`lib/stats.ts`). A card that narrows
> another is like a master–detail list: its click sets a bit of `useState` in the page, and the detail card runs the
> same `filterWithCamera` the Grid uses on the chosen row's filter before counting.
