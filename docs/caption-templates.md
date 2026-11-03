# Caption Templates

`/caption-templates`, under **Configuration** in the sidebar, keeps captions for social media posts with placeholders
for a photo's fields. On the Photo page, each post in the **Social media posts** card has a template picker and a
**Generate** button above its caption, which fills the template in from the photo's data, including changes not saved
yet, and the post's hashtags. Generate asks before writing over a caption that has text. The picker starts on the first
template for the post's platform, or else the first one for any platform.

The page lists the templates on the left and edits the chosen one, or a new one, on the right, with a **Preview** of the
caption for any of the portfolio's photos and the list of **Placeholders**, each a button that puts it in the template.
A placeholder no photo field is called is shown under the preview and left empty.

> **Frontend analogy:** a template is like a tagged template literal, `` `${title}\n${date}` ``, written by hand and
> kept as data. Generate is the function that runs it with the photo as its arguments.

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

- **`{field}`** is the field's value. Any field of the photo JSON with text or a number can be used, such as
  `{customCity}` or `{createDate}`, as well as the ones below, which are worked out from it.
- **`{a|b}`** is the first of the fields that has a value, such as `{placeLocal|place}`.
- **`[…]`**, square brackets around a part with a placeholder in it, leaves the part out when a placeholder in it is
  empty, so a photo with a manual aperture loses `, ƒ ` along with its aperture. Brackets without a placeholder are
  kept as they are.
- **A line** whose placeholders are all empty is left out, and blank lines in a row become one.

| Placeholder                                      | What it is                                                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `{date}`, `{year}`, `{month}`, `{day}`, `{time}` | When it was taken, the custom date first: `2026.05.17`, `2026`, `05`, `17`, `13:58`                            |
| `{lens}`, `{lensShort}`                          | The lens after camera overrides and the custom lens, and only up to its focal length (`XF18-135mm`)            |
| `{focalLength}`                                  | The real focal length (not the 35 mm equivalent), rounded to whole mm, or one decimal under 10mm               |
| `{places}`                                       | Every place, each localized, the later ones after their relation: `경복궁 (Gyeongbokgung), near 장고 (Janggo)` |
| `{place}`, `{mainPlace}`                         | The most specific place, and the outermost place the photo's places are in                                     |
| `{city}`, `{state}`, `{country}`                 | Each the custom one first                                                                                      |
| `{albums}`, `{tags}`, `{genres}`                 | Their names, with commas between                                                                               |
| `{hashtags}`                                     | The post's hashtags, each with its `#`                                                                         |

Each of `place`, `mainPlace`, `city`, `state` and `country` also has `…Local` (its own script, such as `경복궁`),
`…Romanized` (`Gyeongbokgung`) and `…Localized` (`경복궁 (Gyeongbokgung)`, the romanization or else the English name
after the local script), from [localizations](places-and-localizations.md). `…Local` and `…Romanized` are empty without
a localization, and `…Localized` is then the English name.

## The file

Each template is one file, `captions/<id>.json`, and **Commit** combines them into `captions/CAPTIONS.json` the way it
combines custom lenses into `LENSES.json`. Saving or removing one (`PUT /api/captions/<id>` → `PUT /captions/{id}`,
`DELETE /api/captions/<id>` → `DELETE /captions/{id}`) is a [change waiting for Commit](pending-changes.md), counted
by the sync button as a caption template.

```json
{
  "id": "instagram",
  "name": "Instagram",
  "platform": "instagram",
  "template": "{title}\n\n{date}\n…"
}
```

- **`name`** is how the picker lists it. Two templates can't share a name, ignoring case. The ID is made from it when
  the template is first saved, and kept after that.
- **`platform`** is a platform ID from the Social media posts card, such as `instagram`, or `""` for any.
- **`template`** is up to 5,000 characters, saved without trailing blank lines.

Filling templates in happens in the browser (`apps/client-pipeline/src/lib/caption-template.ts`), so the backend only
checks and saves the files.
