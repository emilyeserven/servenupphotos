# Bulk places

**Bulk places** gives [places](../places-and-localizations.md) to up to 50 related photos with one LLM prompt, the way [Suggest a location](../places-and-localizations/suggest-a-location.md) does for one photo. It picks like Bulk tagging, with the same **Photos to pick**, **Pick other photos** and **Start over** (`POST /api/data/bulk-places/pick`, `{ skip, count }`, `PickBulkPlacePhotos` in `github/bulkplaces.go`), but only considers photos without places (an empty or missing `places`, or only rows without an ID), and ranks them by their city or country, genres and date, as they have no places to share.

**Make contact sheets**, optional, puts the picked photos on numbered sheets in R2 for the prompt to link ([Contact sheets](../contact-sheets.md)).

**Copy the place prompt** (`lib/bulk-place-prompt.ts`) copies one prompt for all of them: each photo by its file name, with a link to its Small version and what's known of where it was taken (`knownLines` in `lib/location-prompt.ts`), then every existing place and the same naming and GPS rules as one photo's prompt. It asks the LLM to check each place on Google Maps, or on Naver Map or Kakao Map for a place in South Korea (where Google Maps shows little), and to give that link, the existing place it's in, the place's Wikidata item ID when it has one, and the same fields as one photo's answer, as JSON:

```json
{
  "photos": [
    {
      "photo": "20161216_092741",
      "place": "Hyangwonjeong Pavilion",
      "parent": "Gyeongbokgung Palace",
      "relation": "by",
      "city": "Seoul",
      "state": "",
      "country": "South Korea",
      "latitude": 37.5826,
      "longitude": 126.977,
      "exact": true,
      "mapUrl": "https://map.naver.com/p/search/향원정",
      "wikidata": "",
      "confidence": "medium",
      "reasoning": "…"
    }
  ]
}
```

Paste the answer and **Review the places**. Unlike Bulk tagging, the page reads it itself (`lib/bulk-places.ts`), from its first `{` to its last `}`: each place is matched to an existing one by name or ID, ignoring case, as one photo's answer is; the others are new places, each made once however many photos name it, with the answer's city, state, country and GPS position (`exactLocation` from `exact`), in the parent when that's an existing place. The review lists the new places the ticked photos use, then each photo with its place (and the place it's in, as choosing it on the Photo page adds), where it is, the LLM's confidence and reasoning, and links to check it: the answer's own map link, a search for it on Naver Map (in South Korea) or Google Maps, and its GPS position on Google Maps. A photo starts ticked unless the LLM's confidence is low. When a photo shows no city or country (custom or EXIF), its place's are written in as its custom ones.

The answer doesn't have to be for the picked photos. Before the review, the names in it that aren't picked photos are looked up among every photo (`POST /api/data/photos-by-name`, `FindPhotosByName` in `github/answered.go`); the ones found are reviewed after the picked ones, the rest are listed and skipped, and a picked photo the answer doesn't name is left as it is ([photos outside the batch](../copy-prompts.md#photos-outside-the-batch)).

**Save places for N photos** (`POST /api/data/bulk-places`, `ApplyBulkPlaces`) makes the new places, each checked as saving one on the Places page checks it, and replaces each ticked photo's `places`, sets its `placeName` to the first place's name and writes in the custom city and country, keeping the rest of the file byte for byte, all in one save of [changes waiting for Commit](../pending-changes.md). Nothing is saved when a place can't be made or a photo can't be read.

Once that's saved, each new place the answer gave a Wikidata ID gets its real outline as its [area](../places-and-localizations/areas.md) (`components/bulk-places/place-outlines.tsx`). The places are done one at a time through the area search (`GET /api/areas?q=Q…`, which follows the item's OpenStreetMap relation, two requests a second apart), and the first outline found is saved (`PUT /api/places/{id}/area`) as another change waiting for Commit. A list under the review says how each went: saved, no outline on OpenStreetMap (the maps then circle the place's GPS position), or what went wrong. The LLM only names the item; it never writes coordinates for the outline, since it would make up a plausible shape.

> **Frontend analogy:** asking for an icon's name in a library such as Lucide rather than for its SVG path: the name can be checked, and the real path is fetched from the source.

## No place found

When the answer names a photo but gives it no place (an empty `"place"`), **Review the places** remembers it in this browser's local storage (`stores/no-place-found.ts`, key `pipeline-no-place-found`, by the photo file's path) and marks it **No place found** in the review, with the LLM's reasoning. From then on, each pick sends those paths as `noPlaceFound` (`BulkPlacePickOptions`), and the backend neither picks them nor counts them in **N of M photos have no places yet**; the line adds “Leaving out N photos an LLM found no place for.” A photo the answer leaves out isn't remembered, since the LLM may just have missed it. The Dashboard's **Photos without a place** row leaves them out too.

**Pick it again** on a photo's row forgets that one (and **Don't pick it again** remembers it once more), and **Pick them again** under the count forgets them all. As it's kept in the browser, another browser or a cleared one picks them again; once a photo gets a place some other way, it's no longer without one, so being remembered changes nothing.

> **Frontend analogy:** a "dismissed" list in `localStorage`, like hiding a banner for good, sent along with the query as an exclude filter so the server's counts match what you see.

> **Frontend analogy:** the same dry run and commit as Bulk tagging, with the dry run done client-side: parsing the answer is a pure function of the pasted text and the cached places query, like a `useMemo` over form input.
