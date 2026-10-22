# Portfolio Filters

The portfolio's Timeline, Table, Map and Grid each have three dropdowns under their title that narrow the photos they
show: **Location**, **Album** and **Tag**. The filters are kept in the URL, so a link keeps them, and the menu's view
links carry them to the other views (and nothing else: a view's own settings, such as the Grid's sort or the Table's
columns, stay with that view). **Clear filters** removes all three.

> **Frontend analogy:** like TanStack Router search params shared by sibling routes: each route's `validateSearch`
> reads the same filter keys, and the menu's `<Link search={(prev) => parseFilters(prev)}>` passes them along.

## Location

One country, city or place, as a tree: each country the photos were taken in, the cities in it, and the places in each
city, each place under the place it's in (see [Places](places-and-localizations.md#places)). Names are written the way
the menu's **Script display** says. Choosing one shows the photos taken there:

- **A country** (`?country=South Korea`): photos whose country is that one.
- **A city** (`?city=Seoul`): photos whose city is that one.
- **A place** (`?place=gyeongbokgung-palace`): photos that list the place, or a place inside it, so Gyeongbokgung
  Palace also shows the photos at Geunjeongmun Gate.

A photo's country and city are its custom ones from the Photo page, or else its EXIF ones, or else the first of its
places (or a place they're in) that has one. A photo with a city but no country gets the country other photos in that
city have, so it's listed under, and matched by, that country too. Countries and cities are matched by their English
names, whichever way they're shown.

## Album and Tag

**Album** lists every album in `ALLALBUMS.json`, each sub-album under its parent. Choosing an album (`?album=<id>`)
shows the photos in it and in any album inside it. **Tag** lists every tag in `ALLTAGS.json` (`?tag=<id>`), and is left
out while there are no tags.

## Counts

Each choice says how many photos it would show in that view, given the other two filters, so a location's count is out
of the photos the chosen album and tag leave. The Map counts only photos it can place and the Grid only photos with
resized versions. The Timeline's counts leave out its time range, which still applies on top of the filters.

When the filters leave no photos, the view says so instead of its list; the Map shows no markers and moves out to the
whole world. Changing a filter on the Map fits it to the photos it now shows.
