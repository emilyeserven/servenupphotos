# Photo page sections

The Photo page, editing a saved photo (`/exif?edit=<path>`, or `/exif?photo=<id>`), groups its cards into sections
with a subnavigation, so each part is a click away instead of somewhere down a long page of cards. The subnavigation
is a column on the left on a wide window and wrapping rows above the cards on a phone.

| Section             | Cards                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Details**         | Title and comment (with date taken, alt text and [photographer notes](photo-notes.md)), Location, Re-edit |
| **Albums & tags**   | Albums, tags and genres                                                                                   |
| **Image**           | Square Thumbnail, [Pixelate faces](face-pixelation.md), [Replace image](replace-image.md)                 |
| **Original**        | [Unedited original](unedited-originals.md): comparison, the edit's crop, its pixelation and upload        |
| **Camera & lens**   | [Camera overrides](camera-overrides.md), with the [custom lens](custom-lenses.md)                         |
| **Posts & related** | Social media posts ([Publish](publish.md)), [More like this](more-like-this.md)                           |
| **JSON**            | JSON to Upload: the file as saving would write it                                                         |

- The section shown is kept in the URL as `?section=` (`groups`, `image`, `original`, `camera`, `sharing` or `json`; Details
  without it), so a link or a reload opens the same one. Saving a new title, which renames the file, keeps it.
- A dot beside a section marks unsaved changes there: a field changed from the saved JSON, or the Square Thumbnail's
  square moved (**Image**). **JSON** has one whenever there's anything to save. Pixelate faces saves on its own, so it
  doesn't mark **Image**.
- **Save changes** at the top right saves every section at once, wherever the change was made.
- Switching sections only hides the others, so anything typed or drawn but not saved, such as face boxes, is still
  there when you come back.

> **Frontend analogy:** the sections are tabs whose panels stay mounted with `hidden`, rather than routes that unmount,
> so component state survives a switch; only the tab's name goes into the URL's search params.

Adding a new photo (`/exif` with nothing chosen yet) keeps its two columns, since it's a sequence of steps.
