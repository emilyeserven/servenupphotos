# Places

A button that opens the places in columns, like a Mac's Finder in column view (`components/place-columns.tsx`, `lib/place-tree.ts`): the countries the photos were taken in first, and clicking one opens a column beside it of what's in it, its regions (states, provinces and prefectures), then a region's cities, a city's places, and each place's places inside it (see [Places](../places-and-localizations/places.md)), each with how many photos it would show and an arrow while it has more in it. Opening a place in a column closes the columns after it, and the newest column scrolls into view. Each place has a checkbox, and any number can be checked in any columns, so places in different countries can be chosen at once; a place with nothing in it is checked by clicking its name too. **Clear** unchecks them all. The picker opens on the columns around the first chosen place, or the only country when there's one. A search swaps the columns for every matching place, with what it's in under its name, such as "Japan › Yamaguchi › Hagi". Names are written the way the **Script display** setting says, and a search matches them that way or in English. The button shows the one chosen name, or how many are chosen. `?state=none` keeps the photos with no state, province or prefecture, as the Numbers page's **No region** row links to; the button then says **No region**.

Any number can be chosen, and the view shows the photos taken in **any** of them:

- **A country** (`?country=South Korea`): photos whose country is that one.
- **A city** (`?city=Seoul`): photos whose city is that one.
- **A place** (`?place=gyeongbokgung-palace`): photos that list the place, or a place inside it, so Gyeongbokgung Palace also shows the photos at Geunjeongmun Gate.

One of a kind is kept as text, as above, so a link to one place stays readable; more become a list (`?place=["gyeongbokgung-palace","mirror-pond"]`).

A photo's country and city are its custom ones from the Photo page, or else its EXIF ones, or else the first of its places (or a place they're in) that has one. A photo with a city but no country gets the country other photos in that city have, so it's listed under, and matched by, that country too. Countries and cities are matched by their English names, whichever way they're shown. A name listed in another one's **Other names** in the pipeline's localizations counts as that one (`mainName` in `lib/localize.ts`), so photos whose EXIF says "United States" are shown, listed and filtered as the United States of America.

On the Map, **Places** doesn't filter: it has the same columns without checkboxes, and picking one moves the map to it instead (see [Portfolio Map](../portfolio-map.md)). There, clicking a place with nothing in it picks it, and each column after the countries starts with **All of** the place it's in, such as **All of Japan**, to pick that one.
