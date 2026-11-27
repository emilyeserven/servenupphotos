# Places

A place is somewhere photos are taken, more exactly than their city, such as Gyeongbokgung Palace. Each is one file, `places/<id>.json`, `{ "id", "name", "description", "parent", "city", "country" }` (plus `"latitude"` and `"longitude"` when it has a GPS position), and **Commit** combines them into `places/PLACES.json`. Its ID is made from its name the way album IDs are (`Gyeongbokgung Palace` becomes `gyeongbokgung-palace`); a name with no letter or number from a to z, such as `경복궁`, gets its UTF-8 bytes in hex instead. Two places can't share a name, ignoring case.

`parent` is the ID of the less specific place it's in, such as Gyeongbokgung Palace for Geunjeongmun Gate, or `""`. A place can't be in itself or in a place that's in it, and its parent must be a place. `city` and `country` are where it is, or `""`; older place files don't have these three, and read as empty.

The Places page is a list on the left and an edit panel on the right (on a phone, the panel comes first). A link with `?edit=city/seoul` (or `place/<id>`), as [Quick Edit](../quick-edit.md) opens, starts with that row in the panel. The list is one tree of every country, the cities in it, and the places in each city, each with an icon on the left: a globe for a country, a building for a city and a pin for a place (with a check inside for a place marked as an exact location). A place is listed under the place it's in, or else its city (its own, or a place above it's), or else its country; a city under its country; anything with nothing above it at the top, after the countries. Cities and countries come from the places' city and country, from the photos' (their custom city and country, or else their EXIF ones), and from the ones [added with **New**](#adding-a-country-state-or-city); a city only photos have says **Inferred from photos**. Each row has its local script, a GPS icon (see [GPS position](gps-position.md)) and how many photos have it; a place's count links to the [Gallery showing its photos](../gallery.md#a-places-photos), which also opens from **See photos in Gallery** at the top of its panel. A row with rows under it has an arrow to collapse or expand them; **Expand all** and **Collapse all** sit above the list, next to **Search**, which narrows it to the names with the search text in them and what they're in.

Each place row has a checkbox, and the one in the list's header checks every place shown (or unchecks them). While any are checked, a bar above the list sets a **City** (with its country, when known) and an **In** place on all of them; an empty field leaves each place's own. **In** doesn't offer the checked places or any place in one of them, so no place ends up in itself. **Save N places** saves each place it changes as its own queued save, and the list shows them moved at once; when they've all saved, the places are unchecked, and any that failed are named.

Choosing a row edits it in the panel; **New** opens a menu to empty the panel for a new place, city, state or country. A place's panel changes its name, description, parent (**In**, which lists only places that aren't in it), city, country and GPS position (its ID stays), and its localization: romanization, local pronunciation and local script, as on the Localizations page. A city's or country's panel shows where it is and how many cities, places and photos have it, and edits its localization (and for a city or state, where it is; see below), since its name comes from the places and photos that have it. Each field's title has an ⓘ beside it whose tooltip says what to write, with an example. **Save changes**, or **Save** at the top right (the rightmost floating button, next to the sync button), saves the place when it changed and its localization when that did, each as its own save. The list shows the change as soon as Save is pressed, before the backend answers, and reads the files again if the save fails.

> **Frontend analogy:** an optimistic update with TanStack Query: `onMutate` writes the new entry into the cached query, `onSuccess` swaps in what the server saved, and `onError` invalidates the query to undo it.

A place's **City** is a combobox of the list's cities, sorted by name, with inferred ones marked by how many photos show them, or a new one typed in. Choosing a city whose country is known fills in **Country**. **State** and **Country** are comboboxes the same way, of the states and countries places are in or photos show, so a place with no city can still have them chosen; choosing a state whose country is known fills in **Country** too. Saving (`PUT /api/places/<id>` → `PUT /places/{id}`) keeps the file as a [change waiting for Commit](../pending-changes.md), and the list reads the place files themselves (`GET /api/places` → `GET /places`, as the next Commit will have them), so a place shows before it's committed to `PLACES.json`.

## Adding a country, state or city

**New → City**, **New → State** or **New → Country** opens a form for one no photo or place has yet: its name, where it is (a city's **State** and **Country**, a state's **Country**, each a combobox like a place's) and its localization. **Add city** saves it as its localization (`localizations/city-<name as an ID>.json`, a [change waiting for Commit](../pending-changes.md)), with where it is as `"state"` and `"country"`:

```json
{
  "id": "city-kanazawa",
  "type": "city",
  "name": "Kanazawa",
  "romanization": "",
  "pronunciation": "",
  "localScript": "金沢",
  "state": "Ishikawa",
  "country": "Japan"
}
```

The list then shows it under its state or country (adding a row for a state or country only it names), selected, with 0 photos, and the **City**, **State** and **Country** comboboxes on places and photos offer it ("No photos yet"). A name already listed, or another name of one, can't be added again. Every saved country, state and city localization is listed this way, so one whose photos have since moved to another name still shows, with 0 photos.

An existing city's or state's panel has the same **State** and **Country** fields. Empty, they show where its places and photos put it as a placeholder; written, they win over that, so a city whose photos disagree can be put in the right state. Only a city keeps a state, and only a city or state keeps a country.

> **Frontend analogy:** the countries, states and cities are a derived list, like a `useMemo` over the photos and places. Adding one writes a seed entry into the same source the list already reads (its localization), instead of a new store, so the derived list picks it up on the next render.

## Connecting words

When a photo has two places and the second is one the first is in (at any depth), the word between them comes from the places, not the photo: “In Geunjeongmun Gate in Gyeongbokgung Palace”, or with a comma, “In Astoria, Queens”. A place's panel sets it with two menus under **In**:

- **Word before …** (only with a parent) is this place's word before the place it's in. It's saved as `"parentRelation"`; **Default** leaves it out and uses the parent's word for the places in it.
- **Word for places in it** is the default for every place in this one that doesn't pick its own, saved as `"childRelation"`; **Default** leaves it out, which is “in”.

Under them, a preview shows the whole phrase: how the place reads with every place it's in (“Mirror Pond, National Museum of Korea”), and how a place in it reads. Either is one of the photo relations (in, at, by, near, …) or `,` for a comma, but not **between** or **and**, which join two places a photo is between rather than a place to the one it's in. When the second place is a few levels up, the word is the one of the place just under it on the way up. Older place files have neither and read as “in”.

> **Frontend analogy:** it's CSS inheritance: a child's own `parentRelation` wins, else it inherits the parent's `childRelation`, else the initial value “in”.
