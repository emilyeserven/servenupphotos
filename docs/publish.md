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
day moves it there, and dropping it on another photo swaps the two. Changes stay unsaved until **Save to GitHub**,
which sets `socialMediaPublishDate` in each changed photo file as one commit, where Update Data commits (the open
**Add photo data** pull request's branch, or a new one). Only that field changes in each file. Nothing is saved
while a photo file can't be read, or if two photos would land on the same day. The page reads the photo files with
`GET /api/publish/instagram` and saves with `PUT /api/publish/instagram` (`{"dates": [{"path", "date"}]}`, a
`null` date unschedules).

> **Frontend analogy:** it's an optimistic form over the photo files: edits live in component state until you save,
> then go out as one batched request, like a "Save all" button on an editable table.

`/site-spotlight` is still a stub; ways to change the other fields will come later.
