# Publish

The **Publish** section of the sidebar is for choosing where photos are shown. Each photo JSON file has three fields
for it, which new saves write with their defaults: `isSocialMediaEligible` (`false`), whether the photo may be posted
to social media; `websiteSpotlight` (`null`), the photo's place among the photos spotlighted on the site, or `null`
when it isn't spotlighted; and `socialMediaPublishDate` (`null`), the day the photo is scheduled to post to social
media, as `YYYY-MM-DD`. Older files may be missing them, which means the same as the defaults.

`/instagram` is a calendar of the photos scheduled to post, one a day. It shows three weeks, starting with this one
(Sunday first), and pages a week at a time. Clicking an empty day picks a photo for it from the photo files, read
where Update Data reads them, so photos in flight on the **Add photo data** pull request are included and marked as
such (eligible photos first); clicking a scheduled photo changes or removes it. Dragging a photo to another
day moves it there, and dropping it on another photo swaps the two. The page reads the photo files with
`GET /api/publish/instagram`, each with its whole JSON as `data`.

Each change is kept in the app as a [local edit](combined-data-store.md#local-edits) right away: the sync button at the
top right counts the photo, and `ALLPHOTOS.json` in the app shows the new date. Nothing goes to GitHub until
**Commit**, which sets `socialMediaPublishDate` in each changed photo file in the same commit as `ALLPHOTOS.json`. Only
that field changes in each file. (`PUT /api/publish/instagram`, which saves dates on their own, is still there but the
page doesn't use it.)

> **Frontend analogy:** it's a draft kept in a client-side store (persisted to `localStorage`) instead of component
> state, so it survives a reload and other pages can see it; Commit is the one "Save all" request.

## Social media posts

The Photo page in edit mode (`/exif?edit=<path>`) has a **Social media posts** card, for keeping track of where the
photo is posted or scheduled to post. Each post has a platform, a status (`scheduled` or `posted`), a day, a link, a
caption and hashtags, saved as the photo file's `socialPosts` list, `[]` by default (new saves write it, and Update
Data → Missing fields adds it to older files):

```json
"socialPosts": [
  {
    "platform": "instagram",
    "status": "posted",
    "date": "2026-10-20",
    "url": "https://www.instagram.com/p/…",
    "caption": "Late light over the river.",
    "hashtags": ["streetphotography", "nyc"]
  }
]
```

`date` is `YYYY-MM-DD`, or `null` when it's left empty. Hashtags are typed separated by spaces or commas, with or
without the `#`, and saved without it. The platforms offered are listed in
`apps/client-pipeline/src/lib/social-posts.ts` (Instagram, Threads, Bluesky, Facebook and Other); add one there to offer
it. A post with a platform that isn't listed, such as one typed into the JSON, keeps it.

The card is saved with the rest of the page's changes by **Save changes**, as a change waiting for Commit, so nothing
goes to GitHub until **Commit**. Saving writes the whole list over the file's. When the Instagram calendar has the photo
scheduled, the card says for which day and links to it; that day is still set on the calendar
(`socialMediaPublishDate`), separately from the posts.

## Site Spotlight

`/site-spotlight` picks the photos each **spotlight zone** of the portfolio shows, saved as each photo file's
`spotlightZones`: a list of zone IDs, `[]` by default (new saves write it, and Update Data → Missing fields adds it to
older files). The zones are listed in `apps/client-pipeline/src/lib/site-spotlight.ts`; the first is **Homepage**
(`"homepage"`), the photos fading in and out behind the [portfolio homepage](portfolio-homepage.md). With none picked,
the homepage shows the 5 newest photos instead.

Each zone is a card of its photos, newest first, each with a button to take it out, and **Add photos** opens every
photo file (read like the Instagram calendar, in flight ones included) to click in or out of it. Like the calendar's
dates, changes are [local edits](combined-data-store.md#local-edits) until **Commit**, which replaces the
`spotlightZones` list in each changed file. A list sent in an edit replaces the file's whole list; other fields are
left as they are.

`websiteSpotlight` isn't used yet; ways to change it will come later.
