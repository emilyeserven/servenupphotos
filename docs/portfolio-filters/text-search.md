# Text search

The Grid and the Timeline have a search box before **Show filters** (`components/photo-search-box.tsx`), always shown, that narrows the photos to ones whose **title**, **location** or **camera model** has the text (`?q=seoul x-t5`, `lib/text-search.ts`). Each word has to be found somewhere in those, in any order, so "seoul x-t5" finds the photos taken in Seoul on a Fujifilm X-T5. It ignores case and accents ("sao paulo" finds São Paulo), and the location is matched every way it can be written: its places, city, state and country in English, romanized, phonetic and native script, whichever the **Script display** setting shows.

The URL changes as you type, replacing the page's history entry rather than adding one per letter. The search counts as one filter on the **Show filters** button, the X inside the box or the button's clear X clears it, and the filters' counts are out of the photos it leaves. The menu carries it between the Grid and the Timeline, but not to the other views, which have no box.

> **Frontend analogy:** each photo's searchable text is joined into one lowercase string once and kept in a `WeakMap`, so a keystroke is just `words.every((word) => text.includes(word))` over the photos, like a memoized selector.
