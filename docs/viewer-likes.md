# User Likes

`/viewer-likes`, **User Likes** under **Publish** in the sidebar, collects the photos people liked on the portfolio. A visitor likes
photos on the portfolio's **My Likes** page and sends you the text **Send to photographer** makes, in one of two forms:

- **Discord:** a Markdown list of photo links with their titles and comments, such as
  `- [Castle Door](https://servenupphotos.net/photos/284/) – love the stones`.
- **Messenger / Text:** the liked photos' IDs joined with commas, such as `281, 284, 286`.

On User Likes you name who sent it and paste the text (or
upload it as a `.txt` or `.json` file), and the pipeline adds one like to each of those photos.

Each list belongs to a **person**. Importing a new list for someone who already sent one replaces their old list
instead of adding to it, so a person who sends their likes twice still counts once per photo.

> **Frontend analogy:** each person's list is like a `Set<photoId>` keyed by their name in a `Map`. Importing does
> `likes.set(person, new Set(ids))`, never `add`, and a photo's total is how many of the sets have it:
> `[...likes.values()].filter((s) => s.has(id)).length`.

## The file

Each person is one file, `likes/<id>.json`, and **Commit** combines them into `likes/LIKES.json` the way it combines
the timeline labels into `TIMELINE.json`:

```json
{
  "id": "jane",
  "name": "Jane",
  "photos": [271, 281, 284],
  "importedAt": "2026-11-03T03:32:11Z"
}
```

- **`photos`** are the [photo IDs](data-model.md#photo-ids) they liked, lowest first, each once.
- **`importedAt`** is when their list was last imported, set by the pipeline on each save.
- The ID is the name as an ID, made when the person is added and kept if they're renamed. Two people can't share an
  ID, so a second "Jane" needs a different name, such as "Jane D.".

The portfolio doesn't read `LIKES.json`; it only sits in the data folder with the rest of the photo data. The names
are committed to the repository, so use a first name, initials or a nickname if the repository is public.

## The page

The left side lists everyone who sent a list, with how many photos they liked and when their list was imported.
The right side imports for the chosen person, or a new one after **New person**:

- **Their list** takes the text from **Send to photographer**, in either form. When it has photo links in it
  (`/photos/284/`, or a `?photo=284` link such as the Grid's), the IDs are read from the links only, so numbers in the
  titles and comments don't count as photos. Otherwise it's read as IDs separated by commas or spaces, and a JSON
  array, such as `[281, 284]`, works too. Before
  saving it says how many photos the list has, which IDs don't match a saved photo (they're kept, in case the photo is
  only waiting for Commit elsewhere), and anything that isn't a photo ID (left out).
- **Import likes** saves a new person; **Save and replace likes** replaces the chosen person's list, or saves a new
  name with the same list when nothing is pasted. **Remove person** removes them and their likes.

Saving (`PUT /api/likes/<id>` → `PUT /likes/{id}`) and removing (`DELETE /api/likes/<id>` → `DELETE /likes/{id}`)
keep the file as a [change waiting for Commit](pending-changes.md), counted by the sync button as a viewer likes list.
The page reads the lists from the [combined data store](combined-data-store.md)'s `LIKES.json` with those changes
made over it, so a saved list counts at once.

**Most liked**, under them, lists the photos with the most likes, summed across everyone, with their titles and IDs.
The [Gallery](gallery.md) shows the same total on each liked photo's tile, as a heart and a number.
