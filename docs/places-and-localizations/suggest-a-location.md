# Suggest a location

When a photo is being edited, the sparkle button beside the Location card's **Place** label asks an LLM where it was taken, like [Suggest tags](../albums-and-tags.md#suggest-tags) does for tags. It copies a prompt to paste into a chat with any LLM that can see images (`lib/location-prompt.ts`). It has:

- A link to the photo's **Small** version (500px on its long edge), or its Medium one when it has no Small, for the same token reasons as Suggest tags.
- Everything already known of where it was taken, one fact per line, leaving out what's empty: its title, its places (with their relation, city, state, country and GPS position, and whether that position is exact), the place name when it has no places, the EXIF GPS position and custom one, the EXIF and custom city, state and country, and the comment.
- Every place in `PLACES.json`, the same way, to reuse when the photo was taken at one.
- The rules: trust what's known unless the photo contradicts it, name the most specific place it can, write names as English does, give a best-estimate GPS position even when it only inferred the place or the area (with `exact` false), and answer with only one JSON object:

```json
{
  "place": "Gwangjang Market",
  "relation": "at",
  "city": "Seoul",
  "state": "",
  "country": "South Korea",
  "latitude": 37.57,
  "longitude": 127.0098,
  "exact": false,
  "confidence": "medium",
  "reasoning": "…"
}
```

Once it's copied, a field under the **Place** label takes the LLM's answer, and **Read the answer** reads the JSON from its first `{` to its last `}`, so a code fence or words around it don't matter, and curly double quotes (“ ”) copied from a chat app are read as straight ones ([Pasting the answer](../copy-prompts.md#pasting-the-answer)). It shows the confidence and reasoning, then each field where the answer says something new, with what the photo shows there now (its custom value, else the EXIF one, else the city and country its places give it) and a checkbox, ticked when the photo has nothing there yet:

- **Place**: the place, matched to one in `PLACES.json` by name or ID, ignoring case. Ticking it makes it the photo's place (with the place it's in second, as choosing it in the Location card does). One that isn't a place yet is saved as a new place file first (a change waiting for Commit), with the answer's city, state, country and GPS position, and **Exact location** set from `exact`.
- **City**, **State or province** and **Country**: saved as the custom ones, or left empty when the answer matches the EXIF value.
- **GPS position**: saved as the custom GPS position. It's offered, and ticked when the photo has no GPS position, even when the LLM only inferred roughly where the photo is; it then says so. When the EXIF has a position, it says the map would show this one instead.

**Fill in N ticked** puts them into the Location card as an edit that **Save changes** saves.

To ask about many photos without places at once, use [Places → Bulk Places](../update-data/bulk-places.md).

> **Frontend analogy:** it's the Tags field's paste handling with a JSON body instead of a CSV: parse, diff each field against the form's current value, and show a "review changes" list of checkboxes before patching the form state.
