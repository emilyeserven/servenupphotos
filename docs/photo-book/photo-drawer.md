# The photo book's photo drawer

**Photos**, on the **Photo Pages** tab, opens and closes a drawer to the right of the pages (under them on a narrow screen), like the [Instagram calendar's](../publish/picking-photos.md#photo-drawer). It lists the photos of the book's album and the albums inside it (Smart Albums by their rules), in the album's order as the portfolio shows it, with changes waiting for Commit, and not the [Undecided](../photos-in-flight.md#undecided) ones. Until an album is picked it asks for one. It has:

- a search by title or file name,
- **Filter** beside it, with **All**, **Horizontal**, **Vertical** and **Square** under it as a quick orientation filter (the same `?orientation=` as the Visuals picker in the flyout), and **Filter** opens the portfolio Grid's filters (places, album, tag, genre, camera, lens, the setting and time of day sliders, and colors, as on the [Gallery](../gallery.md)) in a flyout, saying how many are set; the photos stay in the album's order, and the filters stay in the URL,
- **Show photos already in the book**, off at first, so each photo is used once.

A photo already on a page (in the book or not) is faded in the drawer, and shows fully on hover, so the ones still to place stand out. Pointing at a faded photo shows a small arrow button that scrolls to the first page drawn with it (its outline flashes); each click after goes to the next one, back to the first after the last. Once pages have [tags](the-book.md), **Fade photos on**, a dropdown under the checkbox, picks whose photos are faded: **All pages**', or only the pages with one tag, so with one run of pages tagged "by place" and another "by theme", each run's photos can be placed without the other's fading them.

Drag a photo onto any place on a page, or click it to fill the first empty place on any page. A photo dragged from one place to another moves there with its caption, swapping with the photo already there; one dragged from a page onto the drawer comes off that page. The × on a photo also takes it off. A photo from the drawer always goes in as a new one, so with **Show photos already in the book** on, the same photo can be put on a second page.

> **Frontend analogy:** the drawer and the pages share one HTML5 drag type that carries the photo file's path, like `dataTransfer.setData("text/uri-list", …)`; a drag from a page also carries the place it started from (`page:slot`), so each drop target knows whether it's a move or a new photo.
