# Places and Localizations

`/places` and `/localizations`, under **Configuration** in the sidebar, keep two more kinds of data next to the photos,
albums and tags. Nothing on the portfolio shows them yet; they're noted for later.

## Places

A place is somewhere photos are taken, more exactly than their city, such as Gyeongbokgung Palace. Each is one file,
`places/<id>.json`, `{ "id", "name", "description" }`, and **Commit** combines them into `places/PLACES.json`. Its ID
is made from its name the way album IDs are (`Gyeongbokgung Palace` becomes `gyeongbokgung-palace`); a name with no
letter or number from a to z, such as `경복궁`, gets its UTF-8 bytes in hex instead. Two places can't share a name,
ignoring case.

The Places page adds a place, or changes one's name and description (its ID stays), and lists every place with its
local script and how many photos list it. Saving (`PUT /api/places/<id>` → `PUT /places/{id}`) commits the file to the
open **Add photo data** pull request, or opens one, and the list reads the place files themselves
(`GET /api/places` → `GET /places`, at the pull request's head), so a place shows before it's committed to
`PLACES.json`.

## A photo's places

On the Photo page and in Edit Photo, **Place** replaces the old place name text box. It's one row, or two after
**Add a second place**, and each row is a relation (none, in, at, by, near, on, inside, outside, behind, in front of,
across from, above, below, overlooking, from) and a combobox that picks one place. Its search matches each place's
name and its saved romanization, local pronunciation and local script, so “경복” or “gyeongbok” both find
Gyeongbokgung Palace. Typing a name that isn't a place offers **Add “…” as a place**, which saves it as above and chooses it. Under the rows, the places read as a phrase:
“In Gyeongbokgung Palace by Geunjeongmun Gate”, or “Near Gyeongbokgung” with one place and a relation.

They're saved in the photo's JSON as `places`, next to `albums` and `tags`:

```json
"places": [
  { "relation": "in", "id": "gyeongbokgung-palace" },
  { "relation": "by", "id": "geunjeongmun-gate" }
]
```

`placeName` stays, and is set to the first place's name, so the portfolio keeps showing it as before. A photo saved
before places has a `placeName` and no `places`: Edit Photo shows that place name above the rows, read-only, for
reference while you choose or add the matching places. Once the photo is saved with places it no longer shows. New photos get `"places": []`, and **Update Data → Missing fields**
adds it to older ones.

> **Frontend analogy:** `places` is like a list of `{ preposition, ref }` objects pointing into a normalized store,
> the way a photo's `albums` hold album IDs; `placeName` is a denormalized copy kept for the one component that
> already reads it.

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
