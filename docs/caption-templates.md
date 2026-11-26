# Caption Templates

`/caption-templates`, **Captions** under **Publish** in the sidebar, keeps captions for social media posts and the [Photo Book](photo-book.md) with placeholders for a photo's fields. There's one bank of templates for both. On the Photo page, each post in the **Social media posts** card has a template picker and a **Generate** button above its caption, which fills the template in from the photo's data, including changes not saved yet, and the post's hashtags. Generate asks before writing over a caption that has text. The picker starts on the first template for the post's platform, or else the first one for any platform.

The page lists the templates on the left and edits the chosen one, or a new one, on the right, with a **Preview** of the caption for any of the portfolio's photos and a table of **Placeholders**: each one's button, which puts it in the template, what it is, and an example of what it's filled with for one of the portfolio's photos (the newest to start, named above the table, with #travelphotography as its post's hashtags; "Empty for this photo" when it has nothing). **Shuffle** swaps the examples for another photo's, picked at random. A placeholder no photo field is called is shown under the preview and left empty.

> **Frontend analogy:** a template is like a tagged template literal, `` `${title}\n${date}` ``, written by hand and kept as data. Generate is the function that runs it with the photo as its arguments.

## The template

```text
{title}

{date}
{camera}[, {lensShort} @ {focalLength}mm][, {exposure}sec][, ƒ {aperture}][, ISO {iso}]
{places|cityLocalized}

{comment}

{hashtags}
```

makes

```text
Gyeonghoeru Pavilion (경회루) and Gyeonghoeji Pond (경회루 연지).

2026.05.17
Fujifilm X-T5, XF18-135mm @ 25mm, 1/500sec, ƒ 5.6, ISO 125
경복궁 (Gyeongbokgung), near 근정문 (Geunjeongmun)

The thing about solo traveling…

#travelphotography
```

- **`{field}`** is the field's value. Any field of the photo JSON with text or a number can be used, such as `{customCity}` or `{createDate}`, as well as the ones below, which are worked out from it.
- **`{a|b}`** is the first of the fields that has a value, such as `{placeLocal|place}`.
- **`[…]`**, square brackets around a part with a placeholder in it, leaves the part out when a placeholder in it is empty, so a photo with a manual aperture loses `, ƒ ` along with its aperture. Brackets without a placeholder are kept as they are.
- **A line** whose placeholders are all empty is left out, and blank lines in a row become one.

| Placeholder | What it is |
| --- | --- |
| `{date}`, `{year}`, `{month}`, `{day}`, `{time}` | When it was taken, the custom date first: `2026.05.17`, `2026`, `05`, `17`, `13:58` |
| `{lens}`, `{lensShort}` | The lens after camera overrides and the custom lens, and only up to its focal length (`XF18-135mm`) |
| `{focalLength}` | The real focal length (not the 35 mm equivalent), rounded to whole mm, or one decimal under 10mm |
| `{places}` | Every place, each localized, the later ones after their relation: `경복궁 (Gyeongbokgung), near 장고 (Janggo)` |
| `{place}`, `{mainPlace}` | The most specific place, and the outermost place the photo's places are in |
| `{city}`, `{state}`, `{country}` | Each the custom one first |
| `{albums}`, `{tags}`, `{genres}` | Their names, with commas between |
| `{hashtags}` | The post's hashtags, each with its `#` |

Each of `place`, `mainPlace`, `city`, `state` and `country` also has `…Local` (its own script, such as `경복궁`), `…Romanized` (`Gyeongbokgung`) and `…Localized` (`경복궁 (Gyeongbokgung)`, the romanization or else the English name after the local script), from [localizations](places-and-localizations.md). `…Local` and `…Romanized` are empty without a localization, and `…Localized` is then the English name.

## Smaller and italic text

`<small>…</small>` around part of a template draws it at 80% of the size around it, and `<i>…</i>` draws it in italics; one inside the other is both, such as `<small><i>{places}</i></small>`. **Smaller** and **Italic** under the template's text box put them around what's selected. They're for the [Photo Book](photo-book.md)'s captions, on its pages and in its PDF, and for a caption typed over there; the Preview draws them too. Generate and the Instagram walkthrough leave them out, since a social media post's caption is plain text. A line that's smaller all through gets a line height to match, so its lines sit as close as larger text's. `<gap />`, a self-closing tag anywhere in a line, gives it a quarter line of room above it; **Space above** puts it at the start of the cursor's line. `<gap/>` and the older `<gap>` work too. It's a tag rather than a `{gap}` placeholder, since a placeholder no field is called would be empty and drop its line. A line whose placeholders are all empty is still left out with its marks (`apps/client-pipeline/src/lib/caption-styles.ts`).

## Keeping words together

A caption in the Photo Book wraps wherever its line runs out of room, which can split "ISO 400" or "San Francisco" across two lines. Two ways keep them on one line, both in the template, and both for the Photo Book and the Preview only, since a social media post's caption is plain text:

- **Keep together**, next to **Space above**, puts `<nobr>…</nobr>` around what's selected, such as `<nobr>ISO {iso}</nobr>`, so that part of the template, whatever it fills in with, never breaks.
- **Never break**, in the **Names** card, lists values that never break wherever they show up in a caption, such as `San Francisco`, whichever placeholder or place name form wrote them.

Each part kept together has its spaces swapped for non-breaking spaces and a word joiner put after each hyphen, the characters that tell a browser not to break a line there; the marks are left out. Generate and the Instagram walkthrough write them as plain spaces and hyphens again (`apps/client-pipeline/src/lib/caption-keep-together.ts`).

> **Frontend analogy:** it's `white-space: nowrap` on a few words, done with the `&nbsp;` and `&NoBreak;` characters so it survives in plain text and the PDF.

## US state abbreviations

**Abbreviate US states**, in the **Names** card, writes each US state (and Washington, D.C.) in its standard two-letter abbreviation, such as `CA` for `California`, in every state placeholder (`{state}`, `{stateLocal}`, `{stateRomanized}`, `{stateLocalized}` and `{customState}`) and in the place name builder's forms, the Placeholders table's examples and the Preview included. A state that isn't a US state written out in full is left as it is (`apps/client-pipeline/src/lib/us-states.ts`).

## Place name builder

Place names have many shapes: one place or two, a city with a state or without. The **Place name builder**, between the preview and the placeholders, gives each template its own list of forms for the place name, and `{from_places_form}` in the template is replaced by the first form that fits the photo:

- Each form has a condition: under it is a button for each of **1st place**, **2nd place**, **3rd place**, **city**, **state** and **country**. A click makes the form need that field (**has city**), another makes it need it empty (**no state**), and a third leaves it out. A form that needs nothing is for any photo. So **has 2nd place** is for a photo with two places or more, and **has city** with **no state** for a city without a state. (A photo with only a place name has a 1st place.)
- A form fits when its condition is met and every placeholder in it outside square brackets has a value, so `{city}, {state}` above `{city}` names the state only when there is one even without a condition. Square brackets work as they do in the template.
- A form can have more lines: **Add a line** puts one under it, such as `{cityRomanized}, {countryRomanized}` under `{cityLocal}, {countryLocal}`, so `{from_places_form}` gives `서울특별시, 대한민국` with `Seoul, South Korea` on the line below. Only the first line decides whether the form fits. A line under it is left out for a photo when a placeholder in it outside square brackets is empty, or when it reads the same as a line above it (ignoring case and spaces), so a place with no local name of its own doesn't get its name twice. A line left out for the photo the form is shown for is struck through.
- A photo no form fits gets nothing for `{from_places_form}`, and its line is left out if that's all it has.

Besides the place placeholders above, a form can use `{place1}`, `{place2}` and `{place3}` (the photo's first three places, each also `…Local`, `…Romanized` and `…Localized`), `{relation2}` and `{relation3}` (how the photo relates to them, such as `near`) and `{placeCount}`. The builder's placeholder buttons put one in the form last clicked. Forms move up and down with the arrows, and order matters.

Each form is drawn as the caption shows it for the photo its example is from: each placeholder is its value, in a tinted box that names the placeholder when hovered, an empty one is a dashed box with its name, and a part in square brackets that's left out is struck through. Clicking the form types in it, with its placeholders in braces, until you click away.

### Exceptions

**Exceptions**, at the bottom of the builder, write text in the place name another way, such as `United States of America` as `USA`. Each is text to find and what it becomes (empty takes it out), swapped in order into whatever a form makes, wherever it appears in it; each counts the photos whose place name it changes. They change `{from_places_form}` only, not a place placeholder used in the template itself.

Each form shows what it makes, as the caption will show it, for one of the portfolio's photos it's the form for, and how many photos it's used for; its **Shuffle** shows another of them. A form no photo uses says so, and the builder counts the photos no form fits. `{from_places_form}`'s row in the Placeholders table and the Preview use the forms as they're typed.

## The file

Each template is one file, `captions/<id>.json`, and **Commit** combines them into `captions/CAPTIONS.json` the way it combines custom lenses into `LENSES.json`. Saving or removing one (`PUT /api/captions/<id>` → `PUT /captions/{id}`, `DELETE /api/captions/<id>` → `DELETE /captions/{id}`) is a [change waiting for Commit](pending-changes.md), counted by the sync button as a caption template.

```json
{
  "id": "instagram",
  "name": "Instagram",
  "platform": "instagram",
  "template": "{title}\n\n{date}\n…"
}
```

- **`name`** is how the picker lists it. Two templates can't share a name, ignoring case. The ID is made from it when the template is first saved, and kept after that.
- **`platform`** is a platform ID from the Social media posts card, such as `instagram`, `photobook` for the Photo Book, or `""` for any. It only sets which template each place starts on; any template can be picked in either.
- **`template`** is up to 5,000 characters, saved without trailing blank lines.
- **`places`** is the place name builder's forms in order, each `{ "has": ["city"], "lacks": ["state"], "text": "{city}, {country}", "more": ["{cityRomanized}"] }`, up to 20, each up to 200 characters with its lines, saved trimmed without empty ones; left out while there are none. `has`, `lacks` and `more` (up to 9 lines under the first) are left out when empty. A form saved before conditions had `"when": "any" | "0" | "1" | "2" | "3+"` for its number of places; it's read as the same condition on the numbered places (`"1"` is **has 1st place**, **no 2nd place**) and saved that way the next time.
- **`placeReplacements`** is the builder's exceptions in order, each `{ "from": "United States of America", "to": "USA" }`, up to 50, without ones with nothing to find; left out while there are none.
- **`noBreak`** is the values that never break, such as `["San Francisco"]`, up to 100, each up to 200 characters, saved trimmed without empty or repeated ones; left out while there are none.
- **`stateAbbreviations`** is `true` when **Abbreviate US states** is on; left out while it's off.

Filling templates in happens in the browser (`apps/client-pipeline/src/lib/caption-template.ts`, and `caption-place-form.ts` for the place name builder), so the backend only checks and saves the files.
