# Tag descriptions

**Tag descriptions** writes descriptions for the tags that have none (an empty or missing `description`), with one LLM prompt for a batch of them. The batch is the first tags without a description by ID; **Tags per batch** sets its size (25 at first, 1 to 50), **Skip these N** moves on to the next ones without saving, and **Start over** brings the skipped ones back. Everything it reads is already in the app: the tags from `GET /api/organize`, and the photos from the [combined data store](../combined-data-store.md), with the changes waiting for Commit.

**Copy the description prompt** (`lib/tag-description-prompt.ts`) lists each tag by its ID with what's known of it: its parent tag and the tags under it, how many photos have it, the three countries they're most often from, and the six tags most often beside it, so the LLM can tell which meaning a word has. It asks for one short lowercase phrase per tag, saying which culture a cultural term comes from, and shows up to 8 tags that have descriptions as examples of the style. The answer is JSON:

```json
{
  "descriptions": [
    {
      "tag": "shotengai",
      "description": "a Japanese shopping street, often under a covered arcade"
    }
  ]
}
```

Paste the answer and **Review the descriptions**. It's read in the page, from the first `{` to the last `}`, so a code block or words around it are fine. Each name is matched to a tag by its ID or name (ignoring case, or by the ID made from it), the first description of a tag wins, and names that aren't tags are listed and left out. A tag outside the batch can be described too. Each description can be edited or unticked; one for a tag that already has a description starts unticked, showing the one it has. **Save N descriptions** (`PUT /api/organize/tags/descriptions`, `{ "descriptions": { "<tag ID>": "<text>" } }`) rewrites only each tag file's `description`, trimmed, as [changes waiting for Commit](../pending-changes.md); nothing is saved when an ID isn't a tag, a tag file can't be read, or a description is empty or over 1000 characters. Once saved, the tags are read again, so the batch moves on to the next tags without one.

> **Frontend analogy:** the same paste-back flow as Bulk tagging, but the "dry run" is a pure function in the page instead of a backend call, since every tag is already in the query cache. Only the save goes to the backend.
