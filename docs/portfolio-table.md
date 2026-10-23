# Portfolio Table

The portfolio's Table (`/table`) lists every photo as a row: its thumbnail, title, when it was taken, its place, camera,
lens and camera settings. Clicking a column's name sorts by it (`?sort=…&dir=…`), the **Columns** menu hides columns
(`?hide=…`), and the filters are described in [Portfolio Filters](portfolio-filters.md). Clicking a thumbnail or title
opens the photo viewer.

## View menu

**View** picks how much of each photo's location the **Place** column shows, under **Place names**:

| Choice                  | Shows                                                                       | URL                    |
| ----------------------- | --------------------------------------------------------------------------- | ---------------------- |
| Most specific (default) | The most specific of its places, such as "Geunjeongmun Gate"                | left out               |
| All place names         | Its places as a phrase, such as "Geunjeongmun Gate in Gyeongbokgung Palace" | `?placeDetail=places`  |
| Include city            | Its places and its city                                                     | `?placeDetail=city`    |
| Include country         | Its places, its city and its country                                        | `?placeDetail=country` |

A photo without places shows its city, or else its country. The most specific place is the one inside the most others
(see [Places](places-and-localizations.md#places)). Names are written the way the menu's **Script display** says, and
hovering a place shows its GPS position, and its country when the text leaves it out. The column sorts by the text it
shows, in English. The choice stays with the Table: the menu's links to other views don't carry it.
