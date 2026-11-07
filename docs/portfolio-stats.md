# Portfolio Stats

The portfolio's Stats page (`/stats`, `apps/portfolio/src/routes/stats.tsx`) counts the photos by gear, place and time.
It's in the site menu after Tags, with the other small views; like them, the homepage doesn't link to it.

At the top are five headline numbers: photos, countries, cities, cameras and years. Under them, **Gear**, **Places**
and **Time** jump to their sections.

## Filters

The page has the Grid's filters: a **Show filters** button with the [shared filters](portfolio-filters.md), including
time of day, time of year and day of the week, and the [camera filters](portfolio-filters.md#camera-filters). Every
number on the page counts only the photos they leave, and the filters are kept in the URL like on the other views.

## Sections and groups

Each section has groups, each a card listing its values with a bar as long as the value's share of the group's
biggest, and the number of photos:

| Section | Group                       | Rows                                                                                                        | Filter it sets           |
| ------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| Gear    | Cameras                     | each camera, most photos first                                                                              | `camera`                 |
| Gear    | Lenses                      | each lens, most photos first                                                                                | `lens`                   |
| Gear    | Lenses by brand, by type, … | one card for each top-level lens [metadata group](metadata-groups.md) with groups in it, its groups as rows | `lensGroup`              |
| Gear    | Focal length                | the top-level focal length metadata groups, widest first                                                    | `focalLength` (a range)  |
| Places  | Countries                   | each country, most photos first                                                                             | `country`                |
| Places  | Cities                      | each city, most photos first; its country shows on hover                                                    | `city`                   |
| Time    | Time of day                 | Late night to Night                                                                                         | `daypart`                |
| Time    | Season                      | Spring to Winter                                                                                            | `season`                 |
| Time    | Month                       | January to December                                                                                         | `month`                  |
| Time    | Day of the week             | Monday to Sunday                                                                                            | `weekday`                |
| Time    | Year                        | newest first                                                                                                | none: opens the Timeline |

Lens categories come from the lens metadata groups set on the pipeline's Metadata Groups page: a top-level group such
as **Type**, with **Prime** and **Telephoto** in it, makes a **Lenses by type** card. Top-level lens groups with none
in them go together on a **Lens groups** card, and camera groups work the same way. A photo can be in more than one
row of a category, and the card says how many are in none of them.

## Digging in

Clicking a row narrows the whole page to its photos by setting its filter, so clicking **Japan** and then
**Morning** counts the morning photos taken in Japan. A chosen row is highlighted with an X, and clicking it again
clears its filter. The grid button at the end of each row opens the Grid with the page's filters and the row's. A year
opens the Timeline narrowed to that year, with the page's shared filters.

A row with no photos is left out. A group longer than 8 rows shows its first 8 and a **Show all** button, and a group
says how many photos it couldn't count, such as photos without a lens in their EXIF ("10 photos don't say"). A focal
length row counts the photos within the range the Grid's slider would set for it, so the count matches the Grid.

> **Frontend analogy:** the page is a derived view of the URL: `validateSearch` reads the filters, a `useMemo` runs
> the photos through the same `filterWithCamera` the Grid uses, then `lib/stats.ts` does a `groupBy` + `count` for each
> card. A row is a `<Link search={(prev) => ({ ...prev, ...row.filter })}>`, so drilling down is just navigation, and
> the back button undoes it.
