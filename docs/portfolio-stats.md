# Portfolio Stats

The portfolio's Stats page (`/stats`, `apps/portfolio/src/routes/stats.tsx`) counts the photos by gear, place and time.
It's in the site menu after Tags, with the other small views; like them, the homepage doesn't link to it.

At the top are five headline numbers: photos, countries, cities, cameras and years. Under them, **Gear**, **Places**
and **Time** jump to their sections.

## Sections and groups

Each section has groups, each a card listing its values with a bar as long as the value's share of the group's
biggest, and the number of photos:

| Section | Group           | Rows                                                                                    | A row opens                        |
| ------- | --------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| Gear    | Cameras         | each camera, most photos first                                                          | the Grid filtered to that camera   |
| Gear    | Lenses          | each lens, most photos first                                                            | the Grid filtered to that lens     |
| Gear    | Focal length    | the top-level focal length [metadata groups](metadata-groups.md), widest first          | the Grid's focal length range      |
| Places  | Countries       | each country, most photos first                                                         | the Grid filtered to that country  |
| Places  | Cities          | each city with its country, most photos first                                           | the Grid filtered to that city     |
| Time    | Time of day     | Late night (12–5 AM), Early morning, Morning, Afternoon, Evening, Night (9 PM–12 AM)    | the Grid's time of day filter      |
| Time    | Season          | Spring (Mar–May), Summer, Autumn, Winter (Dec–Feb), as the northern hemisphere has them | nothing yet                        |
| Time    | Month           | January to December                                                                     | nothing yet                        |
| Time    | Day of the week | Sunday to Saturday                                                                      | nothing yet                        |
| Time    | Year            | newest first                                                                            | the Timeline narrowed to that year |

Times are by the clock where the photo was taken, as its capture time has no time zone. A row with no photos is left
out. A group longer than 8 rows shows its first 8 and a **Show all** button, and a group says how many photos it
couldn't count, such as photos without a lens in their EXIF ("10 photos don't say"). A focal length row counts the
photos whose focal length is within the range the Grid's slider would set for it, so the count matches the Grid.

Season, Month and Day of the week rows don't link anywhere, as no view filters by them yet.

> **Frontend analogy:** like the Tags page, it's all worked out once when the module loads (`lib/stats.ts`), as the
> photos only change with a new build: a `groupBy` + `count` over the photo array per group, kept in a module-level
> constant instead of state. Each linked row is a `<Link to="/grid" search={{ camera }}>`, reusing the Grid's own URL
> filters.
