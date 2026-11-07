# Portfolio Filters

The Grid and Timeline also have a [text search](#text-search) box. The portfolio's Timeline, Map and Grid each have a **Show filters** button under their title, which opens
filters that narrow the photos they show: **Places**, [Groups](#groups-album-tag-and-genre) and [When](#when) (**Hide filters** closes them again). The
Grid also has the camera filters (see [Camera filters](#camera-filters)), in each of its views, including the Table. Every view with filters (the Grid,
Lucky, the Graph page, the Timeline and, under **More filters**, the Map) also has a **Visuals** button, which opens the Color page's color filters and **Orientation** (see
[Portfolio Color](portfolio-color.md#on-the-grid-page)). Where the camera filters are, it comes with them (`CameraFilterBar`); the Timeline and the
Map add it as their own filters (`visualsOwnFilters`, read with `lib/visual-filters.ts`).
The dropdowns start hidden on each view; while filters are set, the button shows how many, and pointing at it swaps
that number for an X that clears them all (see [Clearing filters](#clearing-filters)). Each filter that's set also has a small X inside its border, to the right of what's chosen, which clears just
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
as one filter on the **Show filters** button, the X inside the box or the button's clear X clears it, and the filters'
counts are out of the photos it leaves. The menu carries it between the Grid and the Timeline, but not to the other
views, which have no box.

> **Frontend analogy:** each photo's searchable text is joined into one lowercase string once and kept in a
> `WeakMap`, so a keystroke is just `words.every((word) => text.includes(word))` over the photos, like a memoized
> selector.

## Places

A button that opens the places in columns, like a Mac's Finder in column view (`components/place-columns.tsx`,
`lib/place-tree.ts`): the countries the photos were taken in first, and clicking one opens a column beside it of what's
in it, its regions (states, provinces and prefectures), then a region's cities, a city's places, and each place's
places inside it (see [Places](places-and-localizations.md#places)), each with how many photos it would show and an
arrow while it has more in it. Opening a place in a column closes the columns after it, and the newest column scrolls
into view. Each place has a checkbox, and any number can be checked in any columns, so places in different countries can
be chosen at once; a place with nothing in it is checked by clicking its name too. **Clear** unchecks them all. The
picker opens on the columns around the first chosen place, or the only country when there's one. A search swaps the
columns for every matching place, with what it's in under its name, such as "Japan › Yamaguchi › Hagi". Names are
written the way the menu's **Script display** says, and a search matches them that way or in English. The button shows
the one chosen name, or how many are chosen.
`?state=none` keeps the photos with no state, province or prefecture, as the Numbers page's **No region** row links to;
the button then says **No region**.

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

On the Map, **Places** doesn't filter: it has the same columns without checkboxes, and picking one moves the map to it
instead (see [Portfolio Map](portfolio-map.md)). There, clicking a place with nothing in it picks it, and each column
after the countries starts with **All of** the place it's in, such as **All of Japan**, to pick that one.

## Chosen photos

The map's **View in grid** can open the Grid on photos chosen one by one (`?ids=[316,317,319]`) when no places cover
just the photos in view (see [Portfolio Map](portfolio-map.md)). There's no dropdown for it: it counts as one filter on
the **Show filters** button, and the button's clear X clears it.

## Groups: Album, Tag and Genre

A **Groups** button opens one picker for the album, tag and genre filters (`components/group-picker.tsx`), like
[When](#when): a list of **Albums**, **Tags** and **Genres** on the left, each saying what it's set to (or "Any") with a
dot while it's set, and the chosen one's choices on the right, each with how many photos it would show given the other
filters. One of each can be chosen at once, and the button's badge says how many are. Clicking the chosen choice again,
or the "All …" row at the top, clears it. On phones the left list folds up above the choices, under a button naming the
section shown, and the picker keeps 16px from the screen's edges.

**Albums** lists every album in `ALLALBUMS.json`, each sub-album under its parent. Choosing an album (`?album=<id>`)
shows the photos in it and in any album inside it. **Tags** lists every tag in `ALLTAGS.json` (`?tag=<id>`), each [under its parent tag](albums-and-tags.md#parent-tags); choosing one shows the photos with it or any tag under it, and is left
out while there are no tags. **Genres** lists every [photographic genre](photographic-genres.md) in `ALLGENRES.json`, by
name (`?genre=<id>`), and is likewise left out while there are none.

## When

A **When** button after **Groups**, on every view with filters (on the Map, under **More filters**), opens one picker
for when the photos were taken (`components/when-filter.tsx`, `components/when-picker-parts.tsx`,
`lib/when-filters.ts`), by the clock and calendar where each was taken, as a photo's capture time has no time zone.
Like the other pickers (see [Picker layout](#picker-layout)), its left side lists **Seasons**, **Months**, **Days**,
**Hours** and **Date range**, each saying what it's set to ("Any", the one or two chosen such as "Spring, Autumn", or
how many, such as "4 hours") with a dot while it's set, and **Clear when** under them while any is; the right side
shows the chosen one's buttons, under a line saying what they do. It picks one way at a time, and choosing in one
clears the others. The picker opens on the one that's set. Every button says how many photos it would show, given the
other filters, and a choice with none is dimmed.

- **Seasons**, **Months**, **Days** and **Hours** pick across all years, and any number of one kind can be on: they
  show the photos in any of them. Above each kind's buttons, one picks just the one it is now, such as **This season ·
  Autumn**, **This month · November**, **Today · Saturday** or **This hour · 2 PM–3 PM**, in every year; clicking it
  again clears it.
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

On the Timeline, the date range is the days it shows.

> **Frontend analogy:** each kind is a multi-select checkbox group kept as repeated search params, like
> `?tag=a&tag=b`, and the left list is a set of radio buttons over which group is in use.

## Picker layout

**Groups**, **When**, **Gear & settings**, **Visuals** and the Graph page's **Graph type** share one layout,
`SectionPicker` in `components/section-picker.tsx`: a list of sections on the left (`SectionTab` in
`components/picker-section-tab.tsx`), each with its name, an icon for Groups, what it's set to under it and a dot while
it's set, an optional footer under the list such as **Clear visuals** (`PickerClear`, whose words and X are one
button), and the chosen section's controls on the right.
The picker keeps 16px from the screen's edges and is at most 28rem tall, scrolling inside. On phones the list folds up
above the controls, behind a button naming the chosen section and what it's set to; while it's open it takes the
controls' place, and choosing a section folds it up again. The Grid's filter buttons open it through
`FilterPickerButton`, which shows the filter's icon, name and how many of its filters are set, and takes the
`onClear` its clear X calls (see [Clearing filters](#clearing-filters)); `PickerPart` puts the
line saying what a section is for over its controls.

A name or value cut off with an ellipsis, in a picker's list, a choice such as a long album in **Groups**, the Places
columns or the Places button, shows all of it on hover (`TruncatedText` in `components/truncated-text.tsx`, which adds
the hover text only while the text is cut off).

> **Frontend analogy:** it's a vertical tabs component whose tab list turns into an accordion header on small screens;
> each picker only supplies the tabs' labels and the panel.

## Clearing filters

Every button that opens filters has a clear X while any of its filters is set (`ClearableTrigger` in
`components/clearable-trigger.tsx`): pointing at the button, or reaching it with the keyboard, swaps the end of it
for an X, which clears just that button's filters without opening it.

- **Groups**, **When**, **Gear & settings** and **Visuals** swap their arrows for the X, and clear their own
  filters: Groups the album, tag and genre, When every "when" filter, Gear & settings the camera, lens and settings
  (not the orientation, which is in Visuals), and Visuals the colors, vividness and orientation. **Clear when** and
  **Clear visuals** under their pickers' lists do the same from inside.
- **Show filters** (or **Hide filters**) swaps its count for the X, which clears every filter, the text search too.
- On the Map, **More filters** swaps its arrows for the X, which clears every filter it holds.
- **Places** keeps the X it always shows while a place is chosen, to the left of its arrows.

On a touch screen, which can't point, the X shows whenever any of the button's filters is set. The Graph page's
Filters tab, which has no Show filters button, keeps a **Clear filters** button instead.

> **Frontend analogy:** the X is a sibling of the trigger button positioned over it, not a child, as a `<button>`
> can't hold another; the wrapper is a Tailwind `group`, so `group-hover:` shows the X and hides the arrows together.

### Picker conventions

Every picker that uses `SectionPicker`, and anything new built like one, follows these, so the pickers look and behave
alike:

- **More about a section goes behind an (i).** The (i) is `InfoButton` (`components/info-button.tsx`), the last thing in
  the section's top row: beside `PickerPart`'s intro line (its `info` prop), or at the right of a section title such as
  **Cameras**. It never hides on phones. What it shows goes in `SectionPicker`'s `aside`, the panel to the right of the
  controls (under them on phones), never inside the controls or in a hover. Pass a wider `width` while the aside shows.
  The aside follows what's pointed at, and falls back to what's chosen, as the presets' settings and the cameras'
  details do.
- **Ways to arrange a list are small menus in the top row.** **Group by** and **Sort** are icon buttons that keep their
  name ("Group by", "Sort") and open a short menu of choices with the current one checked (`PickMenu` in
  `components/pick-menu.tsx`), left of the (i). A button is shaded while it isn't on its first choice, the
  default. They aren't tab rows or segmented controls, which take a row of their own.
- **Grouping is optional and starts off.** The first grouping is **None**, the list A to Z, and the others are Brand
  and Type. A list opens on None unless what's chosen is a group only another grouping lists.
- **Choice lists are text.** A row in a list of choices (`ChoiceRow`) has its check, name and count, and no icon or
  picture; pictures belong in the info pane. The one exception is the Graph page's **Graph type** list, whose rows
  each have their type's icon (`ChoiceRow`'s `icon`), as the owner asked. Headings in a list, such as **DSLR**, are plain small text, not choices.
- **A button that opens filters clears them with an X.** Build it with `FilterPickerButton` (or wrap it in
  `ClearableTrigger`) and pass the `onClear` that clears its filters; never add a separate Clear button beside it.
- **Defaults aren't news.** A section that's at its default says "Any" (or its default's name) in the list, and a button
  only stands out while it's changed.

## Camera filters

The Grid's filters panel also has a **Gear & settings** button after **When** that opens one picker for the camera
filters: the gear a photo was taken with and how it was shot. Its
left side lists **Cameras**, **Lenses**, **Focal length**, **Aperture**, **Exposure** and **ISO**, each with what it's set
to under its name ("Any" while it isn't) and a dot while it's set; the right side shows the chosen one's choices. Unlike
**When**, any number of them can be set at once, and the button's badge counts how many are. The picker opens on the
first one that's set. It keeps 16px from the screen's edges. On phones the list folds up above the choices, behind a
button naming the chosen one, and choosing one folds it up again.

**Cameras** and **Lenses** list every camera or lens (`?camera=Fujifilm X-T5`, `?lens=EF50mm f/1.8 II`; a photo whose
EXIF didn't name a lens is under none) with how many photos each would show; **All cameras** or **All lenses** comes
first, and clicking the checked one again goes back to all. A **Group by** button in the title row, beside the **Sort** button and left of the **(i)**, opens a menu that picks how it's laid out: **None**, every one once, A to Z (the default);
**Brand**; or **Type**. Brand and Type are the top-level metadata groups with those names (that group's own row left
out, what's under it a level up, then any camera or lens it doesn't list). Cameras without such a group get their own,
guessed from the model name: Brand, such as Canon or Fujifilm, and Type (Mirrorless, DSLR, Compact or Phone), each
under a heading, with Unknown last. A grouping with nothing in it isn't offered, and the list opens on the grouping of a
chosen group. Each button is shaded while it isn't on its default. **Sort** opens a menu of the order: **Name** keeps the grouping's order, and **Oldest first** or **Newest
first** orders the cameras or lenses under each heading or group by when the first of the portfolio's photos was taken with each. A choice that would show no photos given the other
filters is left out, unless chosen; **Show N choices hidden by the other filters** lists them dimmed, and hovering one
says which filters hide it: each one that, cleared alone, would let it show photos ("Hidden by Aperture or Lens"), or
"the other filters together" when no single one would. The **(i)** button across from the
**Cameras** or **Lenses** title opens the picker's info pane (see [Picker conventions](#picker-conventions)), the same
one the settings' graphics use, with the details of the camera or lens pointed at, or else
the chosen one: its own sized picture (exactly 267 × 200) and description from the pipeline's [Gear Pictures](gear-pictures.md) page, or else a
drawing of its kind (a DSLR, mirrorless, compact or phone, guessed from its model name) (for a lens, a side view of it,
longer for a longer focal length and with a zoom ring when it zooms). A camera then lists its kind, how many photos
used it, and from when to when. A lens lists its focal length, whether it's a prime or zoom, and its
widest aperture, read from its name, and how many photos used it, on which cameras, at which focal length most, and
from when to when. A group, such as a brand, has no details. The four camera settings each have a slider with a handle
at each end, and their quick picks listed under it. A slider steps through the values the portfolio's
photos have, lowest first, so every step changes what's shown, and says the range it's set to, such as "f/4 – f/5.6".
The URL changes once a handle is let go, keeping the range's ends as the photos write them (`?iso=100-400`,
`?exposure=1/500-1/30`, `?focalLength=18-50`, `?aperture=4-5.6`); dragging both handles back to the ends clears it. Each setting's title sits above its slider, which has a tick under it for every step and its lowest and highest values
at its ends. The **(i)** button across from the title opens the info pane with little
graphics of what its two ends look like, following the handles as they're dragged: the angle of view for focal length, the opening for aperture, a dial
filled for longer exposures beside a moving ball that's sharp at a fast shutter and smeared into a streak at a slow one, and grain for ISO, with a sentence on what the setting does. Clicking it again closes it;
the browser remembers which, for every setting. A
photo without the setting isn't in any range.

The hours of the day are in the [When](#when) picker, which every view with filters has.

**Orientation** is a section of the **Visuals** picker (see
[Portfolio Color](portfolio-color.md#on-the-grid-page)): a list of **Horizontal**, **Vertical** and **Square**, each
drawn as an outlined shape of its proportions, with how many photos the other filters (colors too) leave have that
orientation. Clicking one shows only the photos wider than they're tall (`?orientation=horizontal`), taller than
they're wide (`?orientation=vertical`), or exactly as wide as they're tall (`?orientation=square`); clicking it again
clears it. The photo's size is the one its JSON file saves (`width` and `height`), so a photo not uploaded to R2 yet
has no orientation.

The other views don't have these filters, and the menu's links leave them out. They count toward the button's number, and the button's clear X clears them too.

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
resized versions.

When the filters leave no photos, the view says so instead of its list; the Map shows no markers and moves out to the
whole world. Changing a filter on the Map fits it to the photos it now shows.

A choice that would show no photos, given the other filters, isn't listed, unless it's the one chosen (or, in
**Places**, has a chosen one inside it). The dropdown ends with a greyed-out line saying how many were hidden, and the
Places columns a note under them, such as "40 places hidden by the other filters".

## Remembered view settings

Each of these views remembers its own settings in this browser (`lib/view-options.ts`, saved under
`servenup-view-options` in `localStorage`), so leaving it and coming back from another page opens it the same way:

- **Grid:** square, natural or Table view, **info** under the tiles, the sort (with a color sort's order and secondary
  sort), and the Table's sorted column, hidden columns and Place detail.
- **Color:** the color wheel or Black & white view, and the preview size.
- **Timeline:** its display options, such as technical info shown and thumbnail size.
- **Tags:** the sort, and all tags or the top level only.

Filters (including the Timeline's date range), the open photo and where the Map is looking aren't remembered this way. The Map's
display options are remembered on their own (see [Portfolio Map](portfolio-map.md)). A link with settings in its URL
still opens with them, and a URL without any opens the view's defaults: only links within the site add the remembered
ones.

> **Frontend analogy:** each view's route component writes its settings slice of the search params to `localStorage`
> in a `useEffect`, and links to it build their `search` from that saved slice plus the filters, like restoring a
> tab's last state.
