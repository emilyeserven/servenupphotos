# Describe my style

**Publish › Bio › Describe my style** (`/describe-style`) copies a prompt to paste into a chat with an LLM (Claude, ChatGPT, Gemini, …) that links small versions of your photos and asks it to describe your photography style. Like the other prompts in the pipeline (Bulk tagging, Album Suggestions), nothing is sent to an LLM by the pipeline itself, and nothing is saved: it reads the photo files the Photo Book and Bio read (`DecidedPhotoFiles`, without the [Undecided](photos-in-flight.md#undecided) ones) and only builds text.

## Narrowing the photos down

**Show filters** opens the same filters as the portfolio's [Grid](portfolio-filters.md) and the [Gallery](gallery.md#the-portfolio-grids-filters), kept in the URL under the same names, so a filtered Grid link's search works here too. To ask about one trip, pick its dates in the **When** picker's date range, or its country or cities in **Places**; for a year, its date range; for a camera, lens or genre, those pickers. The card's title says how many photos the prompt links out of how many the filters leave.

### Published photos only

**Published photos only**, next to **Shuffle**, leaves out every photo that isn't on the portfolio yet: drafts, and photos that were added or given a title but are still waiting for Commit or for the photo data pull request to merge. It keeps the photos that are entries of `ALLPHOTOS.json` on the base branch (`inAllPhotos`), the ones the live portfolio shows. It's kept in the URL as `published=true`, so the Grid's filters and their counts work out of those photos only, and the prompt says "published photos" when it's on.

> **Frontend analogy:** like a CMS preview toggle in reverse: instead of showing drafts next to live posts, it shows only what the production build would.

## Saved prompts

**Saved prompts**, at the top, saves the page as it is under a name: the filters in the URL, **Published photos only**, **Photos to link** and **Anything to focus on**. **Load** puts them back (the photos are spread evenly again), and the bin deletes one. Saving under a name already used replaces that one. They're kept in this browser's local storage (`stores/style-prompts.ts`, a Zustand store persisted under `pipeline-style-prompts`), not on GitHub, so they don't wait for Commit and another browser doesn't see them. The prompt's photos aren't saved, only how they're picked, so a loaded prompt picks from the photos as they are now.

## Which photos are linked

**Photos to link** (30 at first, with no upper limit) sets how many go in the prompt, and **All** next to it links every photo the filters leave. A very long prompt may be more links than a chat will open, so a smaller number spread across the photos is usually enough. The photos the filters leave are put in the order they were taken, oldest first, and that many are picked spread evenly from the first to the last, so a long trip or several years are covered from end to end rather than only the start. **Shuffle** picks others at random (still in date order in the prompt), and **Spread evenly again** goes back. The picked photos are shown numbered, as the prompt numbers them.

Each photo is linked by its Small version (500px on its long edge), or Medium, or the full image when it has neither, the same as the tag prompts (`promptImageUrl` in `lib/tag-prompt.ts`): a few hundred tokens each for an LLM, and still enough to see the composition and the edit.

> **Frontend analogy:** it's like a `srcset` picking the smallest image that still looks right, except the "screen" is the LLM's context window, where every pixel costs tokens.

## Contact sheets

**Make contact sheets**, above the copy button, puts the picked photos on numbered sheets of 30 in R2, as on the bulk pages (see [Contact sheets](contact-sheets.md)). Each tile is labeled with the photo's title, or its file name for an untitled one, and its tile number matches the photo's number in the prompt. Once they're made, the prompt lists the sheets and asks the LLM to look through them first, and each photo's line becomes `3. Photo "Amsterdam Canal" (tile 3 on contact sheet 1): https://…-small.webp`. Changing the filters, the number, **Shuffle** or **Published photos only** picks other photos and drops the sheets, so make them again. It's optional: without sheets the prompt is the same as before. For more than a few dozen photos it's worth it, since a chat may not open hundreds of links one by one.

## The prompt

`stylePrompt` in `lib/style-prompt.ts` builds it: how the photos were picked ("30 of the 212 photos that match the filters I chose, spread across them"), the dates and countries they span, what to write about (the style overall, subjects, composition, light and color, gear and settings, how the places and years differ, and what to try next), then one numbered section per photo with its link, title, date, place, camera and lens, settings, genres and tags. **Anything to focus on** adds a question of your own at the end of the asks, such as "How has my street photography changed since 2020?". The whole prompt is shown under the photos to read before copying it.

### The answer as a Markdown note

The prompt asks for the answer as one Markdown note to save as it is in a notes app such as an Obsidian vault, in a ` ```markdown ` code block so the chat doesn't render it before you copy it:

- YAML front matter (Obsidian's **Properties**): `title`, `date` (the day the prompt was copied, in the browser's time zone), `photos`, `taken`, `places`, and `tags`, which include `photography-style` and a few kebab-case words for the style.
- A `#` heading naming the style, then one `##` heading per ask, in the prompt's order, plus one for the **Anything to focus on** question when there is one.
- Photos linked by number to their Small version, such as `[Photo 3](https://…)`, and plain Markdown only (no tables, HTML or emoji).

> **Frontend analogy:** the front matter is like the frontmatter in an MDX or Astro content file: typed fields above the body that the notes app can filter and sort by, the way a content collection's schema does.
