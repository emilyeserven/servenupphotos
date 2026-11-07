# Portfolio Filters

The Grid and Timeline also have a [text search](#text-search) box. The portfolio's Timeline, Map and Grid each have a **Show filters** button under their title, which opens
filters that narrow the photos they show: **Places**, **Album**, **Tag**, **Genre** and [When](#when) (**Hide filters** closes them again). The
Grid also has the camera filters (see [Camera filters](#camera-filters)), in each of its views, including the Table. The Grid's panel also has a **Colors** section, the Color page's color filters (see
[Portfolio Color](portfolio-color.md#on-the-grid-page)).
The dropdowns start hidden on each view; while filters are set, the button shows how many, and **Clear filters** sits
beside it. Each filter that's set also has a small X inside its border, to the right of what's chosen, which clears just
that one (a range slider's X sits beside its range). The filters are kept in the URL, so a link keeps them, and the menu's view
links carry them to the other views. A view's own settings, such as the Grid's sort or its Table's
columns, stay with that view, and are remembered in this browser: the menu's links, the homepage's, the Tags page's
cards and the Map's **View in grid** open a view the way it was last left (see [Remembered view settings](#remembered-view-settings)). The Map is the exception: it always opens with no filters from the menu, or from the photo viewer's
**View on map** on another view, so filters set earlier don't follow you back to it. A link to the Map with filters in
its URL still opens with them.

> **Frontend analogy:** like TanStack Router search params shared by sibling routes: each route's `validateSearch`
> reads the same filter keys, and the menu's `<Link search={(prev) => parseFilters(prev)}>` passes them along.

## Text search

The Grid and the Timeline have a search box before **Show filters** (`components/photo-search-box.tsx`), always shown,
that narrows the photos to ones whose **title**, **location** or **camera model** has the text (`?q=seoul x-t5`,
`lib/text-search.ts`). Each word has to be found somewhere in those, in any order, so "seoul x-t5" finds the photos
taken in Seoul on a Fujifilm X-T5. It ignores case and accents ("sao paulo" finds São Paulo), and the location is
matched every way it can be written: its places, city, state and country in English, romanized, phonetic and native
script, whichever the menu's **Script display** shows.

The URL changes as you type, replacing the page's history entry rather than adding one per letter. The search counts
as one filter on the **Show filters** button, the X inside the box or **Clear filters** clears it, and the filters'
counts are out of the photos it leaves. The menu carries it between the Grid and the Timeline, but not to the other
views, which have no box.

> **Frontend analogy:** each photo's searchable text is joined into one lowercase string once and kept in a
> `WeakMap`, so a keystroke is just `words.every((word) => text.includes(word))` over the photos, like a memoized
> selector.

## Places

A button that opens a searchable tree: each country the photos were taken in, the states in it, the cities in each, and the places in each
city, each place under the place it's in (see [Places](places-and-localizations.md#places)), each with a checkbox and
how many photos it would show. The chevron beside a country, state, city or place with others in it expands or collapses it,
and **Expand all** and **Collapse all** do every one at once; a search shows every match with what it's in, expanded.
The tree starts with whatever's around the chosen ones expanded, and the United States of America always expanded
one level, to its states (`START_EXPANDED` in `components/places-filter.tsx`). Names are written the way the menu's **Script display**
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
names, whichever way they're shown. A name listed in another one's **Other names** in the pipeline's localizations
counts as that one (`mainName` in `lib/localize.ts`), so photos whose EXIF says "United States" are shown, listed and
filtered as the United States of America.

On the Map, **Places** doesn't filter: picking one moves the map to it instead (see
[Portfolio Map](portfolio-map.md)).

## Chosen photos

The map's **View in grid** can open the Grid on photos chosen one by one (`?ids=[316,317,319]`) when no places cover
just the photos in view (see [Portfolio Map](portfolio-map.md)). There's no dropdown for it: it counts as one filter on
the **Show filters** button, and **Clear filters** clears it.

## Album, Tag and Genre

**Album** lists every album in `ALLALBUMS.json`, each sub-album under its parent. Choosing an album (`?album=<id>`)
shows the photos in it and in any album inside it. **Tag** lists every tag in `ALLTAGS.json` (`?tag=<id>`), each [under its parent tag](albums-and-tags.md#parent-tags); choosing one shows the photos with it or any tag under it, and is left
out while there are no tags. **Genre** lists every [photographic genre](photographic-genres.md) in `ALLGENRES.json`, by
name (`?genre=<id>`), and is likewise left out while there are none.

## When

A **When** button after **Genre**, on every view with filters (on the Map, under **More filters**), opens one picker
for when the photos were taken (`components/when-filter.tsx`, `lib/when-filters.ts`), by the clock and calendar where
each was taken, as a photo's capture time has no time zone. It picks one way at a time, each a tab, and choosing in one
clears the others. Every button says how many photos it would show, given the other filters, and a choice with none is
dimmed.

- **Across all years** has a tab for each kind, and any number of one kind can be on: they show the photos in any of
  them. Above each kind's buttons, one picks just the one it is now, such as **This season · Autumn**, **This month ·
  November**, **Today · Saturday** or **This hour · 2 PM–3 PM**, in every year; clicking it again clears it.
  - **Seasons** (`?season=summer&season=winter`), as the northern hemisphere has them: Spring is March to May, and
    Winter is December to February.
  - **Months** (`?month=june&month=july`), in four columns headed by their season.
  - **Days** of the week, Monday first (`?weekday=saturday&weekday=sunday`).
  - **Hours** (`?hour=17&hour=18`, on a 24-hour clock), a row for each part of the day: Late night (12–5 AM), Early
    morning, Morning, Afternoon, Evening and Night (9 PM–12 AM). A part's name turns all its hours on, or off once they
    all are.
- **Date range**: two fields, **From** and **To** (`?start=2024-03-01&end=2024-05-31`, both days included). Each
  shows its day, or "Any day" while that end is open, opens its own calendar when clicked, and has an X that clears
  it. The calendars keep to the months a photo was taken in, open on the field's day or the latest photo's month, and
  keep From on or before To. Clicking the month's name above a calendar swaps the days for every month over the years,
  a row of twelve for each year, newest first, to jump straight to one.

On the Timeline, which has its own time range and Quick dates, the picker only has **Across all years**.

> **Frontend analogy:** each kind is a multi-select checkbox group kept as repeated search params, like
> `?tag=a&tag=b`, and the tabs are radio buttons over which group is in use.

## Camera filters

The Grid's filters panel also has a **Camera** button after **When** that opens one picker for the camera filters. Its
left side lists **Cameras**, **Lenses**, **Focal length**, **Aperture**, **Exposure** and **ISO**, each with what it's set
to under its name ("Any" while it isn't) and a dot while it's set; the right side shows the chosen one's choices. Unlike
**When**, any number of them can be set at once, and the button's badge counts how many are. The picker opens on the
first one that's set.

**Cameras** and **Lenses** list every camera or lens (`?camera=Fujifilm X-T5`, `?lens=EF50mm f/1.8 II`; a photo whose
EXIF didn't name a lens is under none) with how many photos each would show; **All cameras** or **All lenses** comes
first, and clicking the checked one again goes back to all. The four camera settings each have a slider with a handle
at each end, and their quick picks listed under it. A slider steps through the values the portfolio's
photos have, lowest first, so every step changes what's shown, and says the range it's set to, such as "f/4 – f/5.6".
The URL changes once a handle is let go, keeping the range's ends as the photos write them (`?iso=100-400`,
`?exposure=1/500-1/30`, `?focalLength=18-50`, `?aperture=4-5.6`); dragging both handles back to the ends clears it. A
photo without the setting isn't in any range.

The hours of the day are in the [When](#when) picker, which every view with filters has.

**Orientation** sits after the **Camera** button: a horizontal and a vertical rectangle button, each with how many photos the
other filters leave have that orientation. Clicking one shows only the photos wider than they're tall
(`?orientation=horizontal`) or taller than they're wide (`?orientation=vertical`); clicking it again, or its X, clears
it. A square photo is neither, so it's only shown while no orientation is chosen. The photo's size is the one its JSON
file saves (`width` and `height`), so a photo not uploaded to R2 yet has no orientation either.

The other views don't have these filters, and the menu's links leave them out. They count toward the button's number, and **Clear filters** clears them too.

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
- **ISO**, **Exposure**, **Focal length** and **Aperture** each list a quick pick for each of their groups under the
  slider. Each pick shows the lowest and highest values the photos actually have
  inside the group's range, not the range as it's set: a **Moderate** ISO group of 201 to 1600 shows **250 – 1600 ISO**
  when those are the photos' nearest values, and Wide angle's 10 to 24 mm shows **11mm – 24mm** when no photo was taken
  at 10 mm. Choosing one moves the handles to those values (`?focalLength=11-24`); the list checks
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

## Remembered view settings

Each of these views remembers its own settings in this browser (`lib/view-options.ts`, saved under
`servenup-view-options` in `localStorage`), so leaving it and coming back from another page opens it the same way:

- **Grid:** square, natural or Table view, **info** under the tiles, the sort (with a color sort's order and secondary
  sort), and the Table's sorted column, hidden columns and Place detail.
- **Color:** the color wheel or Black & white view, and the preview size.
- **Timeline:** technical info shown, and the chart or heatmap.
- **Tags:** the sort, and all tags or the top level only.

Filters, the open photo, the Timeline's time range and where the Map is looking aren't remembered this way. The Map's
display options are remembered on their own (see [Portfolio Map](portfolio-map.md)). A link with settings in its URL
still opens with them, and a URL without any opens the view's defaults: only links within the site add the remembered
ones.

> **Frontend analogy:** each view's route component writes its settings slice of the search params to `localStorage`
> in a `useEffect`, and links to it build their `search` from that saved slice plus the filters, like restoring a
> tab's last state.
