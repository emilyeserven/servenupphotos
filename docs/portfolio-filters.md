# Portfolio Filters

The portfolio's Timeline, Table, Map and Grid each have a **Show filters** button under their title, which opens three
filters that narrow the photos they show: **Places**, **Album** and **Tag** (**Hide filters** closes them again). The
Table also has filters of its own (see [Table filters](#table-filters)).
The dropdowns start hidden on each view; while filters are set, the button shows how many, and **Clear filters** sits
beside it. The filters are kept in the URL, so a link keeps them, and the menu's view
links carry them to the other views (and nothing else: a view's own settings, such as the Grid's sort or the Table's
columns, stay with that view).

> **Frontend analogy:** like TanStack Router search params shared by sibling routes: each route's `validateSearch`
> reads the same filter keys, and the menu's `<Link search={(prev) => parseFilters(prev)}>` passes them along.

## Places

A button that opens a searchable tree: each country the photos were taken in, the cities in it, and the places in each
city, each place under the place it's in (see [Places](places-and-localizations.md#places)), each with a checkbox and
how many photos it would show. The chevron beside a country, city or place with others in it expands or collapses it,
and **Expand all** and **Collapse all** do every one at once; a search shows every match with what it's in, expanded.
The tree starts with whatever's around the chosen ones expanded. Names are written the way the menu's **Script display**
says, and a search matches them that way or in English. The button shows the one chosen name, or how many are chosen.

Any number can be chosen, and the view shows the photos taken in **any** of them:

- **A country** (`?country=South Korea`): photos whose country is that one.
- **A city** (`?city=Seoul`): photos whose city is that one.
- **A place** (`?place=gyeongbokgung-palace`): photos that list the place, or a place inside it, so Gyeongbokgung
  Palace also shows the photos at Geunjeongmun Gate.

One of a kind is kept as text, as above, so a link to one place stays readable; more become a list
(`?place=["gyeongbokgung-palace","mirror-pond"]`).

A photo's country and city are its custom ones from the Photo page, or else its EXIF ones, or else the first of its
places (or a place they're in) that has one. A photo with a city but no country gets the country other photos in that
city have, so it's listed under, and matched by, that country too. Countries and cities are matched by their English
names, whichever way they're shown.

## Album and Tag

**Album** lists every album in `ALLALBUMS.json`, each sub-album under its parent. Choosing an album (`?album=<id>`)
shows the photos in it and in any album inside it. **Tag** lists every tag in `ALLTAGS.json` (`?tag=<id>`), and is left
out while there are no tags.

## Table filters

The Table's filters panel also has a **Camera** dropdown (`?camera=Fujifilm X-T5`) and a slider with a handle at each end
for each of **ISO**, **Exposure**, **Focal length** and **Aperture**. A slider steps through the values the portfolio's
photos have, lowest first, so every step changes what's shown, and says the range it's set to, such as "f/4 – f/5.6".
The URL changes once a handle is let go, keeping the range's ends as the photos write them (`?iso=100-400`,
`?exposure=1/500-1/30`, `?focalLength=18-50`, `?aperture=4-5.6`); dragging both handles back to the ends clears it. A
photo without the setting isn't in any range. These filters stay on the Table: the menu doesn't carry them to the other
views. They count toward the button's number, and **Clear filters** clears them too.

> **Frontend analogy:** the slider's value is an index into a sorted array of the values, not the value itself, so
> `1/4000` and `30` seconds sit one step apart when nothing's between them, like `<input type="range">` over
> `values[i]`.

## Counts

Each choice says how many photos it would show in that view, given the other filters, so a place's count is out of the
photos the chosen album and tag (and, on the Table, camera and ranges) leave. The Map counts only photos it can place and the Grid only photos with
resized versions. The Timeline's counts leave out its time range, which still applies on top of the filters.

When the filters leave no photos, the view says so instead of its list; the Map shows no markers and moves out to the
whole world. Changing a filter on the Map fits it to the photos it now shows.
