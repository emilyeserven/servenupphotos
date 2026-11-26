# Place hierarchy and city

Choosing a place on Edit Photo or the Photo page follows the places' parents:

- **The parent comes along.** Choosing a place that has a parent, when no other place is chosen, adds the parent as the second place with "in" (or fills an empty second row), so choosing Geunjeongmun Gate gives “In Geunjeongmun Gate in Gyeongbokgung Palace”.
- **Specific first.** Choosing a place when the first place is one the second is in swaps the two places, so the more specific one is first. **Swap places** still swaps them by hand.
- **Offering a parent.** When two places are chosen and neither is in the other, it asks “Is Gwanghwamun Square in Gyeongbokgung Palace?” with **Put it in Gyeongbokgung Palace**, which saves the first place with the second as its parent. It isn't offered when the first place already has a parent.
- **City, state and country.** Choosing a place fills in the photo's custom city and country from the least specific chosen place (the one the other is in, or else the second), or else a place it's in, or else the other chosen place: the first of them with a city or country. They can still be changed by hand afterwards: the **City**, **State** and **Country** boxes are comboboxes of the cities, states and countries on the Places page (inferred ones marked “Inferred from 3 photos”), or a new one typed in. Choosing a city whose country is known fills in the custom country when it's empty and the EXIF country is different. Clearing one goes back to the EXIF one.
- **State, province or prefecture.** Between the city and the country, a **State** holds a state, province, prefecture or other region. It's its own custom field (`customState`, over the EXIF's `state`, read from the EXIF's `State` or `Province-State`) on the Photo page, its own field on a place, its own tab on the Localizations page, and its own level in the Places list and the portfolio's **Places** filter, nested between the country and the city. It's optional throughout: a photo or place with no state lists its city straight under its country, as before. A state with the same name as its city, such as Seoul in Seoul (ignoring case), isn't written twice: the portfolio leaves the state out of the photo's location text and out of the **Places** filter (the city stands for both), and the Places list shows them as one row with the state's and the city's icons. That row is the city's: choosing it edits the city, and what was under the state is listed under it. The state's localization is still on the Localizations page.
- **Localizing.** A chosen place with no localization yet gets a button beside it that opens a dialog for its romanization, local pronunciation and local script, saved like a row on the Localizations page. It isn't shown when the place's country, or else the photo's, is the United States (“United States”, “United States of America”, “USA”, “US” or “America”); a photo with no country shows it.

They're saved in the photo's JSON as `places`, next to `albums` and `tags`:

```json
"places": [
  { "relation": "in", "id": "gyeongbokgung-palace" },
  { "relation": "by", "id": "geunjeongmun-gate" }
]
```

`placeName` stays, set to the first place's name, but it's being phased out: the portfolio no longer shows it. A photo saved before places has a `placeName` and no `places`: Edit Photo shows that place name above the rows, read-only, for reference while you choose or add the matching places. Once the photo is saved with places it no longer shows. New photos get `"places": []`, and **Update Data → Missing fields** adds it to older ones.

> **Frontend analogy:** `places` is like a list of `{ preposition, ref }` objects pointing into a normalized store, the way a photo's `albums` hold album IDs; `placeName` is a leftover denormalized copy nothing on the portfolio reads anymore.
