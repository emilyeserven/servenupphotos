# Places and Localizations

`/places` and `/localizations`, under **Configuration** in the sidebar, keep two more kinds of data next to the photos,
albums and tags. The portfolio shows each photo's places, and writes places, cities and countries the way its
**Script display** setting says (see [On the portfolio](#on-the-portfolio)).

## Places

A place is somewhere photos are taken, more exactly than their city, such as Gyeongbokgung Palace. Each is one file,
`places/<id>.json`, `{ "id", "name", "description", "parent", "city", "country" }`, and **Commit** combines them into `places/PLACES.json`. Its ID
is made from its name the way album IDs are (`Gyeongbokgung Palace` becomes `gyeongbokgung-palace`); a name with no
letter or number from a to z, such as `경복궁`, gets its UTF-8 bytes in hex instead. Two places can't share a name,
ignoring case.

`parent` is the ID of the less specific place it's in, such as Gyeongbokgung Palace for Geunjeongmun Gate, or `""`.
A place can't be in itself or in a place that's in it, and its parent must be a place. `city` and `country` are
where it is, or `""`; older place files don't have these three, and read as empty.

The Places page adds a place, or changes one's name, description, parent (**In**, which lists only places that aren't
in it), city and country (its ID stays), and lists every place with its city, its local script and how many photos
list it. Each place is listed under the place it's in, indented, and a place with places in it has an arrow to collapse
or expand them; **Expand all** and **Collapse all** sit above the table. A place whose parent is missing is listed at
the top.

The list has three tabs, like the Localizations page: **Places**, **Cities** and **Countries**. Cities and countries
come from the places' city and country and from the photos' (their custom city and country, or else their EXIF ones),
each with how many places and photos have it; a city only photos have is marked **Inferred from photos**. **Show
places** on a city, or the **City** box above the Places tab, narrows the places to that city's: those with it as their
own city or a place above them with it.

A place's **City** is a combobox of those cities, sorted by name, with inferred ones marked by how many photos
show them, or a new one typed in. Choosing a city whose country is known fills in **Country**. Saving (`PUT /api/places/<id>` → `PUT /places/{id}`) commits the file to the
open **Add photo data** pull request, or opens one, and the list reads the place files themselves
(`GET /api/places` → `GET /places`, at the pull request's head), so a place shows before it's committed to
`PLACES.json`.

### Inferred places

An old free-text place name (`placeName`) written on two or more photos, ignoring case, that isn't a place's name or
ID yet is an **inferred place**. The Places page lists them under the table, each with **Save as a place**, and the
Photo page's place combobox offers them after the saved places ("Inferred from 3 photos"). Choosing one saves it as a
place (its ID made from its name, as for any new place) and then chooses it. Nothing is saved until one is chosen.

> **Frontend analogy:** like a tag input that suggests tags other posts already use, before they're in the tag list.

## A photo's places

On the Photo page and in Edit Photo, **Place** replaces the old place name text box. It's one row, or two after
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
  first of them with a city or country. They can still be changed by hand afterwards.
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
(`PUT /api/localizations/<id>` → `PUT /localizations/{id}`) commits its file to the pull request, and **Save all**,
at the top right next to the sync button, saves every changed row on every tab. What's typed is kept while switching
tabs.

Saves of places and localizations go through one queue: each is its own commit on top of the pull request's head,
so a save made while another runs waits its turn (its button says **Queued…**, then **Saving…**) instead of racing it
to move the branch. A row already queued isn't queued again.

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
