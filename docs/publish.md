# Publish

The **Publish** section of the sidebar is for choosing where photos are shown. Each photo JSON file has three fields for it, which new saves write with their defaults: `isSocialMediaEligible` (`false`), whether the photo may be posted to social media; `websiteSpotlight` (`null`), the photo's place among the photos spotlighted on the site, or `null` when it isn't spotlighted; and `socialMediaPublishDate` (`null`), the day the photo is scheduled to post to social media, as `YYYY-MM-DD`. Older files may be missing them, which means the same as the defaults.

## Parts

Each part of Publish has its own file in [`publish/`](publish):

- [The Instagram calendar, Social Feed preview, Grid Anchors and Not Stored days](publish/instagram-calendar.md)
- [Suggested photos, the photo drawer and the Focus](publish/picking-photos.md)
- [Planned Posts](publish/planned-posts.md)
- [Social media posts](publish/social-media-posts.md)
- [Site Spotlight, focus spots and header spotlights](publish/site-spotlight.md)
