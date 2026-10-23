# Places and Localizations

`/places` and `/localizations`, under **Configuration** in the sidebar, keep two more kinds of data next to the photos,
albums and tags. The portfolio shows each photo's places, and writes places, cities and countries the way its
**Script display** setting says (see [On the portfolio](#on-the-portfolio)).

## Places

A place is somewhere photos are taken, more exactly than their city, such as Gyeongbokgung Palace. Each is one file,
`places/<id>.json`, `{ "id", "name", "description", "parent", "city", "country" }` (plus `"latitude"` and `"longitude"` when it has a GPS position), and **Commit** combines them into `places/PLACES.json`. Its ID
is made from its name the way album IDs are (`Gyeongbokgung Palace` becomes `gyeongbokgung-palace`); a name with no
letter or number from a to z, such as `경복궁`, gets its UTF-8 bytes in hex instead. Two places can't share a name,
ignoring case.

`parent` is the ID of the less specific place it's in, such as Gyeongbokgung Palace for Geunjeongmun Gate, or `""`.
A place can't be in itself or in a place that's in it, and its parent must be a place. `city` and `country` are
where it is, or `""`; older place files don't have these three, and read as empty.

The Places page is a list on the left and an edit panel on the right (on a phone, the panel comes first). The list is
one tree of every country, the cities in it, and the places in each city, each with an icon on the left: a globe for a
country, a building for a city and a pin for a place. A place is listed under the place it's in, or else its city (its
own, or a place above it's), or else its country; a city under its country; anything with nothing above it at the top,
after the countries. Cities and countries come from the places' city and country and from the photos' (their custom
city and country, or else their EXIF ones); a city only photos have says **Inferred from photos**. Each row has its
local script, a GPS icon (see [GPS position](#gps-position)) and how many photos have it. A row with rows under it has
an arrow to collapse or expand them; **Expand all** and **Collapse all** sit above the list, next to **Search**, which
narrows it to the names with the search text in them and what they're in.

Each place row has a checkbox, and the one in the list's header checks every place shown (or unchecks them).
While any are checked, a bar above the list sets a **City** (with its country, when known) and an **In** place on all
of them; an empty field leaves each place's own. **In** doesn't offer the checked places or any place in one of them,
so no place ends up in itself. **Save N places** saves each place it changes as its own queued save, and the list
shows them moved at once; when they've all saved, the places are unchecked, and any that failed are named.

Choosing a row edits it in the panel; **New place** empties the panel for a new place. A place's panel changes its
name, description, parent (**In**, which lists only places that aren't in it), city, country and GPS position (its ID
stays), and its localization: romanization, local pronunciation and local script, as on the Localizations page. A city's
or country's panel shows where it is and how many cities, places and photos have it, and edits its localization only,
since its name comes from the places and photos that have it. Each field's title has an ⓘ beside it whose tooltip says
what to write, with an example. **Save changes**, or **Save** at the top right (the rightmost
floating button, next to the sync button), saves the place when it changed and its localization when that did, each
as its own save. The list shows the change as soon as Save is pressed, before the backend answers, and reads the
files again if the save fails.

> **Frontend analogy:** an optimistic update with TanStack Query: `onMutate` writes the new entry into the cached
> query, `onSuccess` swaps in what the server saved, and `onError` invalidates the query to undo it.

A place's **City** is a combobox of the list's cities, sorted by name, with inferred ones marked by how many photos
show them, or a new one typed in. Choosing a city whose country is known fills in **Country**. Saving (`PUT /api/places/<id>` → `PUT /places/{id}`) keeps the file as a
[change waiting for Commit](pending-changes.md), and the list reads the place files themselves
(`GET /api/places` → `GET /places`, as the next Commit will have them), so a place shows before it's committed to
`PLACES.json`.

### GPS position

A place can have a **GPS position**, written on the Places page as `latitude, longitude` in decimal degrees (such as
`37.5796, 126.977`, which is what right-clicking a spot in Google Maps copies). It's saved as `latitude` and
`longitude` numbers in the place file, left out when not set; saving refuses only one of them, or one off the globe.
On the portfolio, a photo whose EXIF has no GPS position goes on the map at its first place's position, or else a
place that place is in, or else its next place's. The hover text still shows only an EXIF position. Its map marker gets a
softer border, as the spot is only near where the photo was taken, unless the place is ticked as an **Exact location**
(such as a subway station or a museum, where its photos were taken right at its GPS position): then the marker keeps the
same solid white border as a photo with its own GPS position. It's saved as `"exactLocation": true`, only on a place
with a GPS position, and a place that uses the position of a place it's in is never exact.

The list's GPS column shows a filled crosshair for a place with its own GPS position, a plain one for a place that uses
the position of a place it's in (hover for which), and an amber (!) warning on a place with neither when photos
listing it have no EXIF GPS position and none of their places has one either, so they're missing from the map. Hovering
the warning says how many photos; giving the place, or a place it's in, a position clears it.

> **Frontend analogy:** like a CSS fallback: `top: var(--exif-gps, var(--place-gps))`.

### Inferred places

An old free-text place name (`placeName`) written on two or more photos, ignoring case, that isn't a place's name or
ID yet is an **inferred place**. The Places page lists them under the table, each with **Save as a place**, and the
Photo page's place combobox offers them after the saved places ("Inferred from 3 photos"). Choosing one saves it as a
place (its ID made from its name, as for any new place) and then chooses it. Nothing is saved until one is chosen.

> **Frontend analogy:** like a tag input that suggests tags other posts already use, before they're in the tag list.

## A photo's places

On the Photo page and in Edit Photo, the title and comment are in one card and the photo's location in another:
**Place**, then **City and country**. Under the **Place** title, a line says where the photo goes on the portfolio's
map: a checkmark with the GPS position when its EXIF has one; else the place whose fallback GPS position it uses (its
first place with one, or a place that place is in), with that position; else a warning that it isn't on the map.

**Place** replaces the old place name text box. It's one row, or two after
**Add a second place**, and each row is a relation (none, in, at, by, near, on, inside, outside, behind, in front of,
across from, above, below, overlooking, from) and a combobox that picks one place. Its search matches each place's
name and its saved romanization, local pronunciation and local script, so “경복” or “gyeongbok” both find
Gyeongbokgung Palace. Typing a name that isn't a place offers **Add “…” as a place**, which saves it as above and chooses it. Under the rows, the places read as a phrase:
“In Gyeongbokgung Palace by Geunjeongmun Gate”, or “Near Gyeongbokgung” with one place and a relation. With two
places, **Swap places** swaps which place is first and which second, leaving each relation where it was: “In
Gyeongbokgung Palace by Geunjeongmun Gate” becomes “In Geunjeongmun Gate by Gyeongbokgung Palace”.

### Place hierarchy and city

Choosing a place on Edit Photo or the Photo page follows the places' parents:

- **The parent comes along.** Choosing a place that has a parent, when no other place is chosen, adds the parent as
  the second place with "in" (or fills an empty second row), so choosing Geunjeongmun Gate gives “In Geunjeongmun Gate
  in Gyeongbokgung Palace”.
- **Specific first.** Choosing a place when the first place is one the second is in swaps the two places, so the more
  specific one is first. **Swap places** still swaps them by hand.
- **Offering a parent.** When two places are chosen and neither is in the other, it asks “Is Gwanghwamun Square in
  Gyeongbokgung Palace?” with **Put it in Gyeongbokgung Palace**, which saves the first place with the second as its
  parent. It isn't offered when the first place already has a parent.
- **City and country.** Choosing a place fills in the photo's custom city and country from the least specific chosen
  place (the one the other is in, or else the second), or else a place it's in, or else the other chosen place: the
  first of them with a city or country. They can still be changed by hand afterwards: the **City** and **Country**
  boxes are comboboxes of the cities and countries on the Places page's tabs (inferred ones marked “Inferred from 3
  photos”), or a new one typed in. Choosing a city whose country is known fills in the custom country when it's
  empty and the EXIF country is different. Clearing either goes back to the EXIF one.
- **Localizing.** A chosen place with no localization yet gets a button beside it that opens a dialog for its
  romanization, local pronunciation and local script, saved like a row on the Localizations page. It isn't shown
  when the place's country, or else the photo's, is the United States (“United States”, “United States of America”,
  “USA”, “US” or “America”); a photo with no country shows it.

They're saved in the photo's JSON as `places`, next to `albums` and `tags`:

```json
"places": [
  { "relation": "in", "id": "gyeongbokgung-palace" },
  { "relation": "by", "id": "geunjeongmun-gate" }
]
```

`placeName` stays, set to the first place's name, but it's being phased out: the portfolio no longer shows it. A
photo saved
before places has a `placeName` and no `places`: Edit Photo shows that place name above the rows, read-only, for
reference while you choose or add the matching places. Once the photo is saved with places it no longer shows. New photos get `"places": []`, and **Update Data → Missing fields**
adds it to older ones.

> **Frontend analogy:** `places` is like a list of `{ preposition, ref }` objects pointing into a normalized store,
> the way a photo's `albums` hold album IDs; `placeName` is a leftover denormalized copy nothing on the portfolio
> reads anymore.

## Localizations

A localization notes how a country, city or place is written and said where it is: its **romanization**, its **local
pronunciation** (such as furigana) and its **local script** (such as hangeul, or kanji and kana). Each is one file,
`localizations/<id>.json`, combined into `localizations/LOCALIZATIONS.json`:

```json
{
  "id": "place-gyeongbokgung-palace",
  "type": "place",
  "name": "Gyeongbokgung Palace",
  "romanization": "Gyeongbokgung",
  "pronunciation": "",
  "localScript": "경복궁"
}
```

The ID is the type and the name as an ID (`country-south-korea`, `city-seoul`), or for a place, `place-` and the
place's ID. The Localizations page has a tab each for countries, cities and places. Countries and cities come from
`ALLPHOTOS.json` (at the pull request's head, with saves not committed yet, from the
[combined data store](combined-data-store.md)): each photo's custom country and city, or else its EXIF ones, with how
many photos show each. Places come from the place files. Rows not saved yet say so; each row's **Save**
(`PUT /api/localizations/<id>` → `PUT /localizations/{id}`) keeps its file waiting for Commit, and **Save all**,
at the top right next to the sync button, saves every changed row on every tab. What's typed is kept while switching
tabs.

Saves of places and localizations go through one queue: each checks the others' names and parents, so a save made
while another runs waits its turn (its button says **Queued…**, then **Saving…**) instead of racing it. A row already queued isn't queued again.

> **Frontend analogy:** it's TanStack Query's mutation `scope`: mutations sharing a scope ID run one after another,
> like awaiting each `fetch` in a loop instead of `Promise.all`.

Saves of places and localizations are counted by the sync button at the top right, like albums and tags, and show in
the combined data store's `PLACES.json` and `LOCALIZATIONS.json` until a **Commit** writes them there.

## On the portfolio

The portfolio's menu has a **Script display** setting above the color theme: English, Romanized, Phonetic or Native,
remembered in the visitor's browser (English until they pick). Every place, city and country the portfolio shows
(Timeline, Table, Map, Grid and the photo viewer) is written that way:

| Script display | Shows                   | Such as    |
| -------------- | ----------------------- | ---------- |
| English        | the name                | Tokyo      |
| Romanized      | the romanization        | Tōkyō      |
| Phonetic       | the local pronunciation | とうきょう |
| Native         | the local script        | 東京       |

When the chosen way isn't saved for a name, it shows the most native way that is saved short of it, down to the name:
Native with no local script shows the pronunciation, else the romanization, else the name. Countries and cities are
matched to their localization by name, and places by the place's ID.

A photo with places shows them as a phrase before its city, such as “In 경복궁 by 근정문, 서울”; the relation stays in
English. A photo without places, or whose places aren't in `PLACES.json`, shows only its city and country; the old
`placeName` isn't shown, so give the photo places on the Photo page instead. Places only show once **Commit** has
rebuilt `ALLPHOTOS.json` and `PLACES.json` before the pull request merges. The Table
sorts the Place column by the English names whichever way it's shown.

The Grid shows the place under each title with **Show info** on.

`pnpm photos:local` also writes `PLACES.local.json` and `LOCALIZATIONS.local.json` next to the committed files, and
the local portfolio refreshes them from a running photo pipeline on each page load, so it shows places and
localizations saved in the pipeline, committed or not ([local photo data](local-photo-data.md)).

> **Frontend analogy:** it's i18n with a fallback chain, like `i18next`'s `fallbackLng`: each name has up to four
> “translations”, and a missing one falls back to the next one along instead of showing nothing.
