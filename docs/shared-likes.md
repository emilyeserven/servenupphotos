# Shared Likes

`/shared-likes`, **Shared Likes** under **Albums** in the sidebar, finds the photos that several people all liked, from the Like lists imported on [User Likes](viewer-likes.md), and puts them into one album, or splits them into suggested albums by where they were taken or by what they show. It reads the lists and photos the pipeline already has, so it adds no backend route and saves through the same `POST /api/data/album-suggestions` as [Album Suggestions](update-data/album-suggestions.md).

## Choosing the lists

**Like lists** has a checkbox for each person's list, all ticked to start with, and **Liked in all N / at least K of the N chosen lists**. With every list asked for, the overlap is the photos that are in every ticked list; asking for fewer counts a photo that most of them have ("liked in most lists"). Both are kept in the page's URL (`?skip=mom&atLeast=2`), so a link opens the same overlap. A photo listed twice in one list still counts once for that person.

> **Frontend analogy:** each list is a `Set<photoId>`. The overlap is counting, for each photo, how many sets have it, and keeping the ones whose count is at least the number asked for: with every list asked for, that's a plain set intersection.

## Overlapping Likes

The photos in the overlap as tiles, the ones in the most lists first, then by photo ID. Each tile shows the photo's title (or file name), who liked it ("Everyone" when every ticked list has it) and a heart with how many. Untick a tile to leave the photo out of the albums. Liked IDs that don't match a saved photo (in the photo data pull request or the portfolio) are counted and left out.

## Suggested albums

The ticked photos go into albums one of three ways:

- **One album** (the default): every ticked photo in a single album, named **Shared Likes** to start with.
- **By location** (`?by=location`): one album per city that two or more of the photos share (the Photo page's custom city first, else its EXIF one), then the rest by country, and photos with neither in **No location**.
- **By theme** (`?by=theme`): the tag the most photos share becomes an album, then the tag the most of the photos left share, and so on while a tag is shared by two or more; the photos left are grouped the same way by [genre](photographic-genres.md), and anything still left goes in **Other themes**. Each photo is in one album.

> **Frontend analogy:** the theme grouping is a greedy `groupBy`: like picking the filter chip that matches the most remaining items, moving those items into a bucket, and repeating, so every item lands in exactly one bucket.

Each suggested album has a checkbox, its name in a box to edit, and its photos, each with a checkbox. When the photos are split, a group of one photo, and **No location** or **Other themes**, start unticked. Beside the name it says whether it's a new album and the ID it gets (made from the name as on [Albums](albums-and-tags.md)), or an existing album when the name matches one's ID or name, ignoring case: then the photos are added to that album instead of a new one being made.

**Save albums for N photos** makes the ticked new albums, described as "Liked by Jane, Sam K. and Mom." from the ticked lists, and adds each ticked photo to its album, keeping the albums it's in, as one [change waiting for Commit](pending-changes.md). **Hide the new albums on the portfolio**, ticked to start with, saves the albums it makes [hidden on the portfolio](albums-and-tags.md#showing-or-hiding-on-the-portfolio), since albums of other people's likes are usually for working with, not for the website; an existing album keeps whether it's shown. One save takes any number of photos, as Album Suggestions does.
