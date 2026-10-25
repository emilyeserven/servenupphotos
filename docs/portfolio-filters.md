# Portfolio Filters

The portfolio's Timeline, Map and Grid each have a **Show filters** button under their title, which opens three
filters that narrow the photos they show: **Places**, **Album**, **Tag** and **Genre** (**Hide filters** closes them again). The
Grid also has the camera filters (see [Camera filters](#camera-filters)), in each of its views, including the Table. The Grid's panel also has a **Colors** section, the Color page's color filters (see
[Portfolio Color](portfolio-color.md#on-the-grid-page)).
The dropdowns start hidden on each view; while filters are set, the button shows how many, and **Clear filters** sits
beside it. Each filter that's set also has a small X inside its border, to the right of what's chosen, which clears just
that one (a range slider's X sits beside its range). The filters are kept in the URL, so a link keeps them, and the menu's view
links carry them to the other views (and nothing else: a view's own settings, such as the Grid's sort or its Table's
columns, stay with that view).

> **Frontend analogy:** like TanStack Router search params shared by sibling routes: each route's `validateSearch`
> reads the same filter keys, and the menu's `<Link search={(prev) => parseFilters(prev)}>` passes them along.

## Places

A button that opens a searchable tree: each country the photos were taken in, the states in it, the cities in each, and the places in each
city, each place under the place it's in (see [Places](places-and-localizations.md#places)), each with a checkbox and
how many photos it would show. The chevron beside a country, state, city or place with others in it expands or collapses it,
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

## Chosen photos

The map's **View in grid** can open the Grid on photos chosen one by one (`?ids=[316,317,319]`) when no places cover
just the photos in view (see [Portfolio Map](portfolio-map.md)). There's no dropdown for it: it counts as one filter on
the **Show filters** button, and **Clear filters** clears it.

## Album, Tag and Genre

**Album** lists every album in `ALLALBUMS.json`, each sub-album under its parent. Choosing an album (`?album=<id>`)
shows the photos in it and in any album inside it. **Tag** lists every tag in `ALLTAGS.json` (`?tag=<id>`), each [under its parent tag](albums-and-tags.md#parent-tags); choosing one shows the photos with it or any tag under it, and is left
out while there are no tags. **Genre** lists every [photographic genre](photographic-genres.md) in `ALLGENRES.json`, by
name (`?genre=<id>`), and is likewise left out while there are none.

## Camera filters

The Grid's filters panel also has **Camera** and **Lens** dropdowns (`?camera=Fujifilm X-T5`,
`?lens=EF50mm f/1.8 II`; a photo whose EXIF didn't name a lens is under none) and a slider with a handle at each end
for each of **ISO**, **Exposure**, **Focal length** and **Aperture**. A slider steps through the values the portfolio's
photos have, lowest first, so every step changes what's shown, and says the range it's set to, such as "f/4 – f/5.6".
The URL changes once a handle is let go, keeping the range's ends as the photos write them (`?iso=100-400`,
`?exposure=1/500-1/30`, `?focalLength=18-50`, `?aperture=4-5.6`); dragging both handles back to the ends clears it. A
photo without the setting isn't in any range.

A **Time of day** slider sits after them, stepping through each hour of the day a portfolio photo was taken in, and says
the range as clock times, from the start of the first hour to the end of the last, such as "6 AM – 7 PM"
(`?time=6-18`, the hours on a 24-hour clock). The time is the clock where the photo was taken, as its custom or EXIF date
writes it, so a photo taken at 7 PM in Seoul is a 7 PM photo wherever it's viewed. A range can't wrap past midnight;
pick the evening and early morning hours separately. The other views don't have these filters, and the menu's links leave them out. They count toward the button's number, and **Clear filters** clears them too.

> **Frontend analogy:** the slider's value is an index into a sorted array of the values, not the value itself, so
> `1/4000` and `30` seconds sit one step apart when nothing's between them, like `<input type="range">` over
> `values[i]`.

### Metadata groups

The [metadata groups](metadata-groups.md) in `metainfo/METAINFO.json` show up in the Grid's filters, in their order
(lowest `order` first, then by name, each group under the one it's in):

- **Camera** and **Lens** list their groups first, each indented under the group it's in and followed by the cameras or
  lenses it lists, then every camera or lens no group lists. Choosing a group (`?lensGroup=lens-zoom`,
  `?cameraGroup=<id>`) shows the photos taken with any value it or a group inside it lists; choosing a group clears a
  chosen name and the other way round. A group that would show no photos, given the other filters, isn't listed,
  unless it's the one chosen.
- **ISO**, **Exposure**, **Focal length** and **Aperture** each get a small dropdown to the right of the slider,
  listing a quick pick for each of their groups. Each pick shows the lowest and highest values the photos actually have
  inside the group's range, not the range as it's set: a **Moderate** ISO group of 201 to 1600 shows **250 – 1600 ISO**
  when those are the photos' nearest values, and Wide angle's 10 to 24 mm shows **11mm – 24mm** when no photo was taken
  at 10 mm. Choosing one moves the handles to those values (`?focalLength=11-24`) and closes the list; the list checks
  the one the slider is set to, and choosing that one again clears the slider. A group's range runs from the lowest to
  the highest end of its own range, its values and those of every group in it; a range with only a `min` runs up from
  it, and one with only a `max` up to it. A group no photo is in isn't listed.

> **Frontend analogy:** a quick pick is a preset that calls the same `onChange` as letting go of the handles, so the
> URL only ever holds the plain range; the list works out which one to check by comparing its range to the URL's.

## Counts

Each choice says how many photos it would show in that view, given the other filters, so a place's count is out of the
photos the chosen album and tag (and, on the Grid, camera, lens and ranges) leave. The Map counts only photos it can place and the Grid only photos with
resized versions. The Timeline's counts leave out its time range, which still applies on top of the filters.

When the filters leave no photos, the view says so instead of its list; the Map shows no markers and moves out to the
whole world. Changing a filter on the Map fits it to the photos it now shows.

A choice that would show no photos, given the other filters, isn't listed, unless it's the one chosen (or, in
**Places**, has a chosen one inside it). The dropdown ends with a greyed-out line saying how many were hidden, and the
Places tree a note under it, such as "40 places hidden by the other filters".
