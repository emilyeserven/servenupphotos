# Social media posts

The Photo page in edit mode (`/exif?edit=<path>`) has a **Social media posts** card, for keeping track of where the photo is posted or scheduled to post. Each post has a platform, a day, a link, a caption and hashtags, saved as the photo file's `socialPosts` list, `[]` by default (new saves write it, and Update Data → Missing fields adds it to older files):

```json
"socialPosts": [
  {
    "platform": "instagram",
    "status": "scheduled",
    "date": "2026-10-20",
    "url": "https://www.instagram.com/p/…",
    "caption": "Late light over the river.",
    "hashtags": ["streetphotography", "nyc"]
  }
]
```

`date` is `YYYY-MM-DD`, or `null` when it's left empty. `status` is `"planned"` while the post still has to be put on the site, and `"scheduled"` once it's there, posted or scheduled on the site to post; the card's **Status** field sets it, and a new post starts **Planned**. The Instagram calendar's marks (a check when every post that day is scheduled, a clock while one is planned) and its **Instagram posts** list show the same. A post saved before posts kept their status (or with an older `"posted"`) counts as scheduled when it has a link or its day has come, and as planned otherwise, until it's saved again (`savedStatus` in `social-posts.ts`). Hashtags are typed separated by spaces or commas, with or without the `#`, and saved without it. The platforms offered are listed in `apps/client-pipeline/src/lib/social-posts.ts` (Instagram, Threads, Bluesky, Facebook and Other); add one there to offer it. A post with a platform that isn't listed, such as one typed into the JSON, keeps it.

A post's day is picked on a calendar (shadcn's `Calendar` in a `Popover`, in `apps/client-pipeline/src/components/social-post-date-picker.tsx`), with **Clear** to leave it empty. Days other photos already post on, on the same platform, are grayed out: the days of their `socialPosts` on that platform, and for Instagram their Instagram calendar day (`socialMediaPublishDate`) too. The photos are the ones the Instagram calendar reads (`GET /api/publish/instagram`, gallery and in flight alike), with the changes waiting for Commit and local edits made over them (`postedPhotoFiles` and `useChangedPhotoFiles`, shared with the calendar's posts); the photo being edited is left out. A grayed day can still be picked, since two posts on one day is rare but fine; the field then says which photos already post that day.

> **Frontend analogy:** it's a `disabledDays`-style lookup built from data the app already has, except the days are only styled with a `modifiers` class instead of `disabled`, so the click still goes through.

Above each post's caption, **Generate** writes the caption from a [caption template](../caption-templates.md) and the photo's data as it's being edited, asking first when the caption already has text. The template picked starts as the first one for the post's platform.

The card is saved with the rest of the page's changes by **Save changes**, as a change waiting for Commit, so nothing goes to GitHub until **Commit**. Saving writes the whole list over the file's. When the Instagram calendar has the photo scheduled, the card says for which day and links to it; that day is still set on the calendar (`socialMediaPublishDate`), separately from the posts.
