# On the portfolio

The portfolio's [Settings page](../portfolio-settings.md) has a **Script display** setting above the color theme: English, Romanized, Phonetic or Native, remembered in the visitor's browser (English until they pick). Every place, city and country the portfolio shows (Timeline, Table, Map, Grid and the photo viewer) is written that way:

| Script display | Shows                   | Such as    |
| -------------- | ----------------------- | ---------- |
| English        | the name                | Tokyo      |
| Romanized      | the romanization        | Tōkyō      |
| Phonetic       | the local pronunciation | とうきょう |
| Native         | the local script        | 東京       |

When the chosen way isn't saved for a name, it shows the most native way that is saved short of it, down to the name: Native with no local script shows the pronunciation, else the romanization, else the name. Countries and cities are matched to their localization by name, and places by the place's ID.

A photo with places shows them as a phrase before its city, such as “In 경복궁 by 근정문, 서울”; the relation stays in English. Between a place and one it's in, the phrase uses the places' [connecting word](places.md#connecting-words), such as “In Astoria, Queens”. A photo without places, or whose places aren't in `PLACES.json`, shows only its city and country; the old `placeName` isn't shown, so give the photo places on the Photo page instead. Places only show once **Commit** has rebuilt `ALLPHOTOS.json` and `PLACES.json` before the pull request merges. The Table sorts the Place column by the English names whichever way it's shown.

The Grid shows the place under each title with **Show info** on.

`pnpm photos:local` also writes `PLACES.local.json` and `LOCALIZATIONS.local.json` next to the committed files, and the local portfolio refreshes them from a running photo pipeline on each page load, so it shows places and localizations saved in the pipeline, committed or not ([local photo data](../local-photo-data.md)).

> **Frontend analogy:** it's i18n with a fallback chain, like `i18next`'s `fallbackLng`: each name has up to four “translations”, and a missing one falls back to the next one along instead of showing nothing.
