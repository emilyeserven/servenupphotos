# Describe my style

**Settings › Extra › Describe my style** (`/describe-style`) copies a prompt to paste into a chat with an LLM (Claude,
ChatGPT, Gemini, …) that links small versions of your photos and asks it to describe your photography style. Like the
other prompts in the pipeline (Bulk tagging, Album Suggestions), nothing is sent to an LLM by the pipeline itself, and
nothing is saved: it reads the photo files the Photo Book and Bio read (`DecidedPhotoFiles`, without the
[Undecided](photos-in-flight.md#undecided) ones) and only builds text.

## Narrowing the photos down

**Show filters** opens the same filters as the portfolio's [Grid](portfolio-filters.md) and the
[Gallery](gallery.md#the-portfolio-grids-filters), kept in the URL under the same names, so a filtered Grid link's
search works here too. To ask about one trip, pick its dates in the **When** picker's date range, or its country or
cities in **Places**; for a year, its date range; for a camera, lens or genre, those pickers. The card's title says how
many photos the prompt links out of how many the filters leave.

## Which photos are linked

**Photos to link** (30 at first, 1 to 100) caps how many go in the prompt. The photos the filters leave are put in the
order they were taken, oldest first, and that many are picked spread evenly from the first to the last, so a long trip
or several years are covered from end to end rather than only the start. **Shuffle** picks others at random (still in
date order in the prompt), and **Spread evenly again** goes back. The picked photos are shown numbered, as the prompt
numbers them.

Each photo is linked by its Small version (500px on its long edge), or Medium, or the full image when it has neither,
the same as the tag prompts (`promptImageUrl` in `lib/tag-prompt.ts`): a few hundred tokens each for an LLM, and still
enough to see the composition and the edit.

> **Frontend analogy:** it's like a `srcset` picking the smallest image that still looks right, except the "screen" is
> the LLM's context window, where every pixel costs tokens.

## The prompt

`stylePrompt` in `lib/style-prompt.ts` builds it: how the photos were picked ("30 of the 212 photos that match the
filters I chose, spread across them"), the dates and countries they span, what to write about (the style overall,
subjects, composition, light and color, gear and settings, how the places and years differ, and what to try next),
then one numbered section per photo with its link, title, date, place, camera and lens, settings, genres and tags.
**Anything to focus on** adds a question of your own at the end of the asks, such as "How has my street photography
changed since 2020?". The whole prompt is shown under the photos to read before copying it.

### The answer as a Markdown note

The prompt asks for the answer as one Markdown note to save as it is in a notes app such as an Obsidian vault, in a
` ```markdown ` code block so the chat doesn't render it before you copy it:

- YAML front matter (Obsidian's **Properties**): `title`, `date` (the day the prompt was copied, in the browser's time
  zone), `photos`, `taken`, `places`, and `tags`, which include `photography-style` and a few kebab-case words for the
  style.
- A `#` heading naming the style, then one `##` heading per ask, in the prompt's order, plus one for the
  **Anything to focus on** question when there is one.
- Photos linked by number to their Small version, such as `[Photo 3](https://…)`, and plain Markdown only (no tables,
  HTML or emoji).

> **Frontend analogy:** the front matter is like the frontmatter in an MDX or Astro content file: typed fields above
> the body that the notes app can filter and sort by, the way a content collection's schema does.
