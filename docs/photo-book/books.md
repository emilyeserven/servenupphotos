# Photo books and their Info tab

**Photo Books** lists every book as a card, with the album its photos come from, how many pages are in the book (and how many more could be used), and how many photos are on them; each card opens the book's own page, as the Trips do. **New book** names and makes another (its ID is made from the name, as caption templates' are) and opens it. An old `/photo-book` link opens the list, or the book its `?book=<id>` names.

On a book's page, **All photo books** goes back to the list. Under it, six tabs, each a page of its own with a line under the tabs saying what it's for:

- **Info** (`/photo-books/<id>/info`): the book's name, album, caption template, page size, page budget and Blurb's sizes.
- **Layouts** (`/photo-books/<id>/layouts`): trying out page layouts at the book's page size.
- **Photo Pages** (`/photo-books/<id>/pages`, where the book opens): making photo pages that could be used, and linking them into spreads.
- **Book** (`/photo-books/<id>/book`): putting the pages that will be used in order, adding other pages, and paging through the book.
- **Cover** (`/photo-books/<id>/cover`): the book's cover in the style of Serven Up Photos Vol. 3 ([The Cover tab and PDF for Blurb](cover.md)).
- **List** (`/photo-books/<id>/list`): every photo in the book in printed order, to jump to editing one.

# Info

**Name** renames the book, **Photos from** picks the album its photos come from, **Captions from** picks the [caption template](../caption-templates.md) its captions are filled in with, and **Remove book** removes it after asking.

**Page size** takes the page's width and height in inches, centimeters, millimeters, points or pixels, starting at BookWright's large landscape page, 12.5 × 10.625 in. Only the shape is used: every page on every tab is drawn with width over height as its `aspect-ratio`, shown beside the fields as a small black page. A side that isn't a number more than 0 isn't saved.

**Blurb sizes** are the sizes Blurb's specifications give the book's PDFs, for **PDF for Blurb** and the Cover tab ([Blurb sizes](cover.md#blurb-sizes)).

**Caption titles**, **Start captions with the photo's title**, on to start, can be turned off to leave every caption's first line, the photo's title, out of the book and draw the lines left alike, with none of them bold ([Caption titles](captions.md#caption-titles)).

**Camera names** lists each camera of the photos on the book's pages (after camera overrides), with how many photos have it, and a box for what the book's captions call it instead, such as `X-T5` for `Fujifilm X-T5`; beside it, how the captions write it then. An empty box (or one with the camera's own name) writes the camera as it is. `{camera}` in the book's captions uses the book's name; the photos' data and other captions don't change.

**Lens names** lists each lens of the photos on the book's pages (after camera and lens overrides), with how many photos have it, and a box for what the book's captions leave off the start of its name, such as `Fujinon ` off `Fujinon XF35mmF2 R WR`; beside it, how the captions write it then, or that the name doesn't start with that. `{lens}` and `{lensShort}` in the book's captions use the shorter name; the photos' data and other captions don't change.

**Page titles**, **Show page titles**, on to start, can be turned off to leave every photo page's title out, whatever its layout says; the titles typed are kept for turning them back on. A text page's title is its heading, so it still shows.

**Page budget** sets a **Target** and a **Max** page count, each saved as it's typed; an empty box isn't set, and a target over the max isn't saved. They count printed pages: a spread is two, and other pages and the blank placeholder pages the Book tab adds count too. On **The book**, above the preview, a bar shows the pages in the book against them: the count, how many pages to go to (or past) each, the target marked on a bar that runs to the max, green once the target is reached and red with a warning past the max. A book with no budget shows none of it.
