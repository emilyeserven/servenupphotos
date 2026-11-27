# Localizations

A localization notes how a country, state, city or place is written and said where it is: its **romanization**, its **local pronunciation** (such as furigana) and its **local script** (such as hangeul, or kanji and kana). Each is one file, `localizations/<id>.json`, combined into `localizations/LOCALIZATIONS.json`:

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

The ID is the type and the name as an ID (`country-south-korea`, `city-seoul`), or for a place, `place-` and the place's ID. The Localizations page has a tab each for countries, states, cities, places and [relation words](#relation-words). Countries, states and cities come from `ALLPHOTOS.json` (at the pull request's head, with saves not committed yet, from the [combined data store](../combined-data-store.md)): each photo's custom country and city, or else its EXIF ones, with how many photos show each. Places come from the place files. Rows not saved yet say so; each row's **Save** (`PUT /api/localizations/<id>` → `PUT /localizations/{id}`) keeps its file waiting for Commit, and **Save all**, at the top right next to the sync button, saves every changed row on every tab. What's typed is kept while switching tabs. **Update Data → Localizations** asks an LLM to fill in the ones still missing, up to 50 at a time (see [Update Data](../update-data/localizations.md)).

A city's or state's localization can also say where it is, as `"state"` and `"country"` (see [Adding a country, state or city](places.md#adding-a-country-state-or-city)); they're left out when empty, and the Localizations page keeps them when saving a row.

## Relation words

A photo's relation words (in, near, by, …, the words before its places on the Photo page) are localized too, on the Localizations page's **Relations** tab. A word is written one way in Japan and another in South Korea, so each is localized once per country: the tab has a row for each word the photos use with their places, in each country they're in (the custom country, or else the EXIF one), with how many photos use it there. A comma isn't a word, and a photo with no country adds no row. Each is saved as a localization of type `relation`, with the word as its name and the country it's for:

```json
{
  "id": "relation-near-japan",
  "type": "relation",
  "name": "near",
  "romanization": "{place} no chikaku",
  "pronunciation": "{place}のちかく",
  "localScript": "{place}の近く",
  "country": "Japan"
}
```

Writing `{place}` where the place goes puts the word after it, as Japanese and Korean do (`{place}の近く`, `{place} 근처`); without it, the word goes before the place, as in English. A photo between two places (“Between Kiyo and Uta”) reads `between` before the first place and `and` before the second, so writing `between` as `{place}` and `and` as `と{place}の間` gives “Kiyo とUtaの間”. A relation has no other names, and **Update Data → Localizations** leaves relation words out, since its prompt doesn't ask for `{place}`. The portfolio shows them as [On the portfolio](on-the-portfolio.md) says; captions keep the English word.

> **Frontend analogy:** it's an i18n message with an interpolation slot, like `t("near", { place })` with `"{{place}}の近く"` in the Japanese bundle, where each country is its own locale.

## Other names

A country, state or city can have **other names**: other ways the photos and places write it, such as `"United States"` and `"USA"` for `"United States of America"`. Its name wins over them. They're kept on its localization, as `"otherNames": ["United States", "USA"]` (left out when there are none), and matched ignoring case and spaces at the ends. Saving refuses another name that's already one of another country's (or city's), a name with other names of its own as another name, and other names for a name that's already another one's other name, so a name never wins over a name that wins over others. Other names are per type, so a state and a city can share a name without clashing. A place has no other names.

On the Places page, a country's or city's panel has **Other names** above its localization: pick another country (or city) from the list, or type one. **Save changes** saves them with the localization. The list then counts each other name as the name that wins, so its photos, places and cities move under it at once, and the panel says how many photos and places still write another name, with a link to Update Data. The Photo page's **City** and **Country** comboboxes, and a place's **City**, offer only the winning names too. The Localizations page keeps a country's or city's other names when saving its row.

The names are rewritten in the files, not only shown: **Places → Location Names** (`POST /api/data/location-names/preview`, then `POST /api/data/location-names`) lists every photo file whose `country`, `state`, `city`, `customCountry`, `customState` or `customCity`, and every place file whose `country`, `state` or `city`, is another name, then saves them written as the name that wins, as [changes waiting for Commit](../pending-changes.md). Only those fields change, and nothing is saved while any photo or place file can't be read. A new photo's EXIF country and city get the winning names when it's read (with the [camera overrides](../camera-overrides.md), after them). Removing another name doesn't change files already rewritten.

> **Frontend analogy:** it's a redirect map, like `{ "/old-path": "/new-path" }` in a router: the list follows the redirect as soon as it's saved, and Update Data rewrites the old links in the files themselves.

## A city from its state

Some photos have a state but no city because their state is a city too: Seoul and Busan are each a state and a city, and the EXIF often writes only the state. When a photo has a state but no city (neither `city` nor `customCity`), and the state is named like a city that has a localization (its name or one of its [other names](#other-names), ignoring case), the city is filled in with that city's name. A `customState` fills in `customCity`; otherwise the EXIF `state` fills in `city`. A photo with a custom state that isn't a city is left as it is, even when its EXIF state is one.

A new photo gets it when its EXIF is read, after the other names (`fillCity` in `be-pipeline/internal/github/statecity.go`). **Places → Location Names** fills it in on photos already saved, listing each one in its preview with the other names' changes before saving anything. A city counts once it has a localization, so a state named like a city no photo has yet needs **New → City** first.

> **Frontend analogy:** it's a default value, like `city ?? (isKnownCity(state) ? state : undefined)`, written into the data instead of computed on every render.

Saves of places and localizations go through one queue: each checks the others' names and parents, so a save made while another runs waits its turn (its button says **Queued…**, then **Saving…**) instead of racing it. A row already queued isn't queued again.

> **Frontend analogy:** it's TanStack Query's mutation `scope`: mutations sharing a scope ID run one after another, like awaiting each `fetch` in a loop instead of `Promise.all`.

Saves of places and localizations are counted by the sync button at the top right, like albums and tags, and show in the combined data store's `PLACES.json` and `LOCALIZATIONS.json` until a **Commit** writes them there.
